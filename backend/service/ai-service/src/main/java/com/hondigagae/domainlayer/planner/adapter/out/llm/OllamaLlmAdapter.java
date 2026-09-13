package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.domainlayer.planner.adapter.out.llm.dto.LlmPackingListResponse;
import com.hondigagae.domainlayer.planner.adapter.out.llm.dto.LlmPlanDraftResponse;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.port.out.AiLlmPort;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.PackingList;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftDay;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftItem;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftReason;
import com.hondigagae.global.properties.AiLlmProperties;
import com.hondigagae.shared.travel.plan.PlanItemType;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.stereotype.Component;

/**
 * Spring AI(Ollama) 기반 일정 생성 어댑터.
 *
 * <p>provider 세부사항은 전부 이 클래스 안에 있고, application 계층은 {@link AiLlmPort} 와
 * {@link AiPlanDraft} 만 안다. 모델 교체는 {@code ai-llm.model} 값 하나로 끝나고,
 * provider 교체는 이 어댑터와 모델 빈을 갈아 끼우는 것으로 끝난다 — BossPickSeoul 과 같은 구조다.
 *
 * <p>설계에서 신경 쓴 지점 넷:
 * <ul>
 *   <li><b>구조화 출력</b> - {@link BeanOutputConverter} 가 {@link LlmPlanDraftResponse} 에서
 *       JSON 스키마를 유도해 프롬프트에 싣고, 응답 파싱까지 맡는다. Ollama 의 {@code format=json}
 *       과 함께 걸어 모델이 낸 문자열을 정규식으로 뜯는 코드가 없게 한다</li>
 *   <li><b>환각 방지</b> - 후보 장소를 프롬프트로 주고, 돌아온 placeId 를 다시 후보 집합과
 *       대조한다. 프롬프트만으로는 부족하다 - 규칙을 어기는 일이 드물게 있다</li>
 *   <li><b>서킷</b> - 인스턴스 {@code llm}. 정상 응답이 수십 초라 slow-call 임계를 read
 *       timeout 과 연동해 사실상 끈다</li>
 *   <li><b>토큰 카운터</b> - 로컬 LLM 이라 비용은 없지만 GPU 점유의 근거 데이터로 남긴다</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OllamaLlmAdapter implements AiLlmPort {

    /** 서킷 인스턴스명. provider 와 무관한 단일 인스턴스다 (coding-conventions §10). */
    public static final String CIRCUIT_NAME = "llm";

    /**
     * 항목 종류를 정하지 못했을 때의 값.
     *
     * <p>후보 목록이 전부 장소이고 초안 항목의 대부분이 장소 방문이라 {@code PLACE} 가 가장 덜
     * 틀린다. 무엇보다 {@code targetId} 를 {@code place.id} 로 읽게 하는 유형이라, 확인된
     * 아이디의 뜻과 어긋나지 않는다.
     */
    private static final PlanItemType DEFAULT_ITEM_TYPE = PlanItemType.PLACE;

    /** 파싱 실패 때 로그에 남길 응답 원문 길이. 원인을 가르는 데는 앞부분으로 충분하다. */
    private static final int RAW_RESPONSE_LOG_LIMIT = 500;

    /** 프롬프트가 컨텍스트 창의 이 비율을 넘으면 경고한다. 넘어서면 입력이 잘릴 위험 구간이다. */
    private static final double CONTEXT_WARN_RATIO = 0.7d;

    /*
      Ollama 가 응답에 싣는 나노초 지표. Spring AI 의 OllamaChatModel 이 같은 이름으로
      ChatResponseMetadata 에 옮겨 담는다 (상수가 private 이라 여기에 다시 적는다).

      **이 넷을 나눠 봐야 무엇을 줄일지 정할 수 있다** (#489) — 프리필이 지배적이면
      place-candidate-size 를 줄이는 것이 듣고, 디코드가 지배적이면 프롬프트를 줄여도
      거의 그대로라 모델이나 장비를 봐야 한다.
    */
    private static final String METADATA_TOTAL_DURATION = "total-duration";
    private static final String METADATA_LOAD_DURATION = "load-duration";
    private static final String METADATA_PROMPT_EVAL_DURATION = "prompt-eval-duration";
    private static final String METADATA_EVAL_DURATION = "eval-duration";

    /** 일정 생성 호출임을 로그에서 가른다. 준비물 생성과 소요 특성이 다르다. */
    private static final String OPERATION_PLAN = "plan";
    private static final String OPERATION_PACKING = "packing";

    private final OllamaChatModel ollamaChatModel;
    private final AiPlanPromptFactory aiPlanPromptFactory;
    private final AiLlmProperties aiLlmProperties;
    private final CircuitBreakerRegistry circuitBreakerRegistry;
    private final LlmCallGate llmCallGate;

    private final BeanOutputConverter<LlmPlanDraftResponse> outputConverter =
        new BeanOutputConverter<>(LlmPlanDraftResponse.class);
    private final BeanOutputConverter<LlmPackingListResponse> packingConverter =
        new BeanOutputConverter<>(LlmPackingListResponse.class);

    // 누적 사용량. 로컬 LLM 은 과금이 없지만 GPU 점유·모델 교체 판단의 근거로 남긴다.
    private final AtomicLong totalInputTokens = new AtomicLong();
    private final AtomicLong totalOutputTokens = new AtomicLong();

    @Override
    public AiPlanDraft generatePlanDraft(AiPlanGenerationQuery query) {
        List<PlaceCandidate> candidates = query.safeCandidates();
        if (candidates.isEmpty()) {
            // 후보가 없는데 생성을 시키면 모델이 기억으로 장소를 지어낸다. 차라리 실패시킨다.
            throw new AiPlanException(AiPlanErrorCode.NO_PLACE_CANDIDATES);
        }

        ChatResponse response = request(query);
        LlmPlanDraftResponse draft = extractDraft(response);
        return toDomain(draft, candidates);
    }

    @Override
    public PackingList generatePackingList(PackingChecklistQuery query) {
        String userPrompt = aiPlanPromptFactory.packingUserPrompt(query)
            + "\n\n" + packingConverter.getFormat();
        ChatResponse response = call(OPERATION_PACKING, new Prompt(
            List.of(new SystemMessage(aiPlanPromptFactory.packingSystemPrompt()), new UserMessage(userPrompt)),
            buildRequestOptions()));

        String text = extractText(response);
        LlmPackingListResponse packing;
        try {
            packing = packingConverter.convert(text);
        } catch (RuntimeException exception) {
            logParseFailure("준비물", response, text, exception);
            throw new AiPlanException(AiPlanErrorCode.LLM_RESPONSE_INVALID, exception);
        }
        List<PackingList.PackingItem> items = packing.items() == null ? List.of()
            : packing.items().stream()
                .filter(item -> item.name() != null && !item.name().isBlank())
                .map(item -> PackingList.PackingItem.builder()
                    .category(item.category())
                    .name(item.name())
                    // 이유는 화면의 본문이다. 프롬프트 표기([N일차])가 새면 여기서 걷어낸다 (#233).
                    .reason(LlmTextCleaner.clean(item.reason()))
                    .build())
                .toList();
        return PackingList.builder().items(items).build();
    }

    private ChatResponse request(AiPlanGenerationQuery query) {
        // 스키마 지시를 사용자 프롬프트 끝에 싣는다. Anthropic SDK 의 outputConfig 가 하던
        // 스키마 강제를 provider 중립으로 옮긴 자리다 — format=json 이 "JSON 만" 을 강제하고,
        // 이 지시가 "어떤 JSON 인지" 를 강제한다.
        String userPrompt = aiPlanPromptFactory.userPrompt(query)
            + "\n\n" + outputConverter.getFormat();

        return call(OPERATION_PLAN, new Prompt(
            List.of(new SystemMessage(aiPlanPromptFactory.systemPrompt()), new UserMessage(userPrompt)),
            buildRequestOptions()));
    }

    /**
     * 서킷 적용과 전송 예외 변환을 한 곳에 모은다 — 일정 생성·준비물 생성이 같은 경로를 탄다.
     *
     * <p><b>타임아웃을 연결 불가와 가른다.</b> 전에는 둘 다 AIPLAN_007 이라, dev 에서 실패를
     * 보고도 "LLM 이 안 떠 있나"와 "너무 오래 걸리나" 중 무엇인지 알 수 없었다 (#232).
     * 사용자에게 할 말도 다르다 — 앞은 잠시 후 다시, 뒤는 조건을 줄이라는 안내다.
     *
     * <p><b>차례를 먼저 받는다</b> ({@link LlmCallGate}). 대기를 게이트가 흡수하므로 아래
     * 시계·서킷·read timeout 은 모두 <b>내 차례가 온 뒤</b>만 잰다 — 남을 기다린 시간이
     * 섞이면 동시 제출이 서로의 예산을 깎아 둘 다 죽고(#508), 정상 대기가 서킷의 slow-call 로
     * 집계돼 멀쩡한 provider 를 차단한다.
     */
    private ChatResponse call(String operation, Prompt prompt) {
        return llmCallGate.inTurn(operation, () -> dispatch(operation, prompt));
    }

    /** 차례를 받은 뒤의 실제 호출. 여기서부터가 "모델이 쓴 시간" 이다. */
    private ChatResponse dispatch(String operation, Prompt prompt) {
        long startedAt = System.nanoTime();
        try {
            ChatResponse response = circuitBreakerRegistry.circuitBreaker(CIRCUIT_NAME)
                .executeSupplier(() -> ollamaChatModel.call(prompt));
            // 성공 경로에도 소요를 남긴다. 전에는 실패했을 때만 남아서, 정상인데 느린 것을
            // 로그로 볼 수 없었다 (#489).
            logTiming(operation, prompt, response, elapsedMillis(startedAt));
            return response;
        } catch (CallNotPermittedException exception) {
            log.warn("LLM circuit open, skipping call");
            throw new AiPlanException(AiPlanErrorCode.LLM_UNAVAILABLE, exception);
        } catch (AiPlanException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            long elapsedMs = elapsedMillis(startedAt);
            boolean timedOut = isTimeout(exception);
            log.error("LLM call failed model={} timedOut={} elapsedMs={} timeoutMs={} type={} reason={}",
                aiLlmProperties.model(), timedOut, elapsedMs, aiLlmProperties.timeoutMs(),
                exception.getClass().getSimpleName(), exception.getMessage(), exception);
            throw new AiPlanException(
                timedOut ? AiPlanErrorCode.LLM_TIMEOUT : AiPlanErrorCode.LLM_UNAVAILABLE, exception);
        }
    }

    /**
     * 읽기 타임아웃인지. <b>원인 사슬을 훑는다</b> — RestClient 가
     * {@code ResourceAccessException} 으로 감싸고 그 안에 {@code SocketTimeoutException} 이
     * 들어 있어, 최상위 타입만 보면 타임아웃을 놓친다.
     */
    private boolean isTimeout(Throwable exception) {
        Throwable cause = exception;
        while (cause != null) {
            if (cause instanceof SocketTimeoutException || cause instanceof TimeoutException) {
                return true;
            }
            cause = cause.getCause() == cause ? null : cause.getCause();
        }
        return false;
    }

    private OllamaChatOptions buildRequestOptions() {
        OllamaChatOptions.Builder builder = OllamaChatOptions.builder().format("json");
        // gpt-oss 계열은 low/medium/high 추론 강도를 지원한다. 미지원 모델로 교체해도
        // 기동이 깨지지 않도록 알 수 없는 값은 모델 기본값에 맡긴다.
        String reasoningEffort = aiLlmProperties.reasoningEffort();
        if (reasoningEffort != null) {
            switch (reasoningEffort.toLowerCase(Locale.ROOT)) {
                case "low" -> builder.thinkLow();
                case "medium" -> builder.thinkMedium();
                case "high" -> builder.thinkHigh();
                default -> { }
            }
        }
        return builder.build();
    }

    /**
     * 응답에서 일정안을 꺼내고 사용량을 기록한다.
     *
     * <p>본문이 비는 지점(응답 자체/결과/텍스트)을 구분해 남긴다 — 원인 추적이 갈라지는 자리다.
     */
    private LlmPlanDraftResponse extractDraft(ChatResponse response) {
        String text = extractText(response);
        try {
            return outputConverter.convert(text);
        } catch (RuntimeException exception) {
            logParseFailure("일정", response, text, exception);
            throw new AiPlanException(AiPlanErrorCode.LLM_RESPONSE_INVALID, exception);
        }
    }

    /**
     * 파싱 실패의 원인을 좁힐 수 있게 남긴다.
     *
     * <p>전에는 예외 메시지만 남겨서 <b>모델이 실제로 무엇을 돌려줬는지 알 수 없었다</b> —
     * dev 에서 AIPLAN_010 을 받고도 원인을 좁힐 수단이 없었던 것이 #232 의 첫 항목이다.
     * 다음 셋이 원인을 갈라 준다.
     *
     * <ul>
     *   <li><b>finishReason</b> — {@code length} 면 출력이 {@code num_predict} 에서 잘린 것이다.
     *       프롬프트가 이상한 것이 아니라 출력 예산이 모자란 것이라 고칠 곳이 다르다</li>
     *   <li><b>프롬프트 토큰 수와 컨텍스트 창</b> — 프롬프트가 창에 가까우면 입력이 잘렸다는
     *       뜻이고, 그때는 모델이 스키마 지시를 못 본 채로 답한다</li>
     *   <li><b>응답 원문 앞부분</b> — JSON 이 아닌 산문인지, 잘린 JSON 인지, 스키마가 다른
     *       JSON 인지가 여기서 갈린다</li>
     * </ul>
     *
     * <p>원문은 앞부분만 남긴다. 전체를 남기면 실패가 몰릴 때 로그가 폭발하고, 원인을 가르는
     * 데는 앞부분으로 충분하다. 프롬프트에는 개인정보를 싣지 않으므로(회원 식별 정보 제외)
     * 응답 원문에도 그것이 돌아올 여지가 없다.
     */
    private void logParseFailure(String what, ChatResponse response, String text, RuntimeException exception) {
        log.error("LLM {} 응답을 스키마로 해석할 수 없습니다. model={} finishReason={} promptTokens={} "
                + "contextTokens={} maxTokens={} textLength={} reason={} rawHead={}",
            what, aiLlmProperties.model(), finishReasonOf(response), promptTokensOf(response),
            aiLlmProperties.contextTokens(), aiLlmProperties.maxTokens(),
            // 파서 예외 메시지도 잘라 낸다 - Jackson 은 실패 지점 주변 원문을 메시지에 함께
            // 담아서, 원문만 자르고 여기를 두면 로그 한 줄이 여전히 수백 자씩 불어난다.
            text == null ? 0 : text.length(), head(exception.getMessage()), head(text));
    }

    private String finishReasonOf(ChatResponse response) {
        if (response == null || response.getResult() == null || response.getResult().getMetadata() == null) {
            return "unknown";
        }
        return response.getResult().getMetadata().getFinishReason();
    }

    private long promptTokensOf(ChatResponse response) {
        if (response == null || response.getMetadata() == null || response.getMetadata().getUsage() == null) {
            return -1;
        }
        Integer promptTokens = response.getMetadata().getUsage().getPromptTokens();
        return promptTokens == null ? -1 : promptTokens;
    }

    /** 로그에 실을 앞부분. 줄바꿈은 로그 한 줄이 깨지지 않게 접는다. */
    private String head(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String folded = text.strip().replaceAll("\\s+", " ");
        return folded.length() <= RAW_RESPONSE_LOG_LIMIT
            ? folded
            : folded.substring(0, RAW_RESPONSE_LOG_LIMIT) + "...(truncated)";
    }

    /**
     * 응답 본문을 꺼내고 사용량을 기록한다. 본문이 비는 지점(응답 자체/결과/텍스트)을 구분해
     * 남긴다 — 원인 추적이 갈라지는 자리다.
     */
    private String extractText(ChatResponse response) {
        recordUsage(response);

        if (response == null || response.getResult() == null || response.getResult().getOutput() == null) {
            log.error("LLM 응답에 결과가 없습니다. model={} reason={}",
                aiLlmProperties.model(),
                response == null ? "response null" : response.getResult() == null ? "result null" : "output null");
            throw new AiPlanException(AiPlanErrorCode.LLM_RESPONSE_INVALID);
        }
        String text = response.getResult().getOutput().getText();
        if (text == null || text.isBlank()) {
            log.error("LLM 응답 본문이 비어 있습니다. model={} finishReason={}",
                aiLlmProperties.model(),
                response.getResult().getMetadata() == null ? "unknown" : response.getResult().getMetadata().getFinishReason());
            throw new AiPlanException(AiPlanErrorCode.LLM_RESPONSE_INVALID);
        }
        return text;
    }

    /**
     * 한 번의 호출이 <b>어디에</b> 시간을 썼는지 남긴다 (#489).
     *
     * <p>dev 실측에서 일정 생성 63~71초 중 {@code DRAFTING} 이 98~99.6% 였다. 그런데 그것이
     * <b>프롬프트를 읽는 시간(프리필)인지 토큰을 뱉는 시간(디코드)인지</b> 구분할 수 없어
     * 어느 값을 줄여야 하는지 판단할 근거가 없었다. Ollama 는 그 둘을 나눠 주고 Spring AI 가
     * 메타데이터로 옮겨 담으므로, 여기서 한 줄로 남긴다.
     *
     * <p>읽는 법:
     * <ul>
     *   <li>{@code prefillMs} 가 크다 → 프롬프트가 길다. {@code ai-llm.place-candidate-size} 를 줄인다</li>
     *   <li>{@code decodeMs} 가 크다 → 출력이 길거나 장비가 느리다. 프롬프트를 줄여도 거의 그대로다</li>
     *   <li>{@code loadMs} 가 0 이 아니다 → 모델이 내려갔다 다시 올라왔다. {@code OLLAMA_KEEP_ALIVE} 를 본다</li>
     *   <li>{@code elapsedMs} 와 {@code totalMs} 차이가 크다 → 대기·전송이 끼었다.
     *       {@code OLLAMA_NUM_PARALLEL=1} 이라 다른 요청을 기다린 것일 수 있다 (#508)</li>
     * </ul>
     *
     * <p><b>지표가 없어도 조용히 넘어간다.</b> provider 를 바꾸면 이 키들이 없다 — 계측이
     * 생성을 막으면 안 된다.
     */
    private void logTiming(String operation, Prompt prompt, ChatResponse response, long elapsedMs) {
        log.info("LLM timing operation={} model={} promptChars={} elapsedMs={} totalMs={} loadMs={}"
                + " prefillMs={} decodeMs={} outputTokens={}",
            operation, aiLlmProperties.model(), promptChars(prompt), elapsedMs,
            durationMillis(response, METADATA_TOTAL_DURATION),
            durationMillis(response, METADATA_LOAD_DURATION),
            durationMillis(response, METADATA_PROMPT_EVAL_DURATION),
            durationMillis(response, METADATA_EVAL_DURATION),
            outputTokens(response));
    }

    private long elapsedMillis(long startedAtNanos) {
        return Duration.ofNanos(System.nanoTime() - startedAtNanos).toMillis();
    }

    /** 프롬프트 글자 수. 후보 수를 줄였을 때 실제로 얼마나 줄었는지 보는 기준이다. */
    private int promptChars(Prompt prompt) {
        if (prompt == null || prompt.getInstructions() == null) {
            return 0;
        }
        return prompt.getInstructions().stream()
            .map(message -> message.getText() == null ? "" : message.getText())
            .mapToInt(String::length)
            .sum();
    }

    private Long durationMillis(ChatResponse response, String key) {
        if (response == null || response.getMetadata() == null) {
            return null;
        }
        Object raw = response.getMetadata().get(key);
        // Ollama 는 나노초로 준다. 다른 provider 는 이 키가 아예 없다.
        return raw instanceof Number number ? Duration.ofNanos(number.longValue()).toMillis() : null;
    }

    private Long outputTokens(ChatResponse response) {
        if (response == null || response.getMetadata() == null || response.getMetadata().getUsage() == null) {
            return null;
        }
        return response.getMetadata().getUsage().getCompletionTokens() == null ? null
            : response.getMetadata().getUsage().getCompletionTokens().longValue();
    }

    private void recordUsage(ChatResponse response) {
        if (response == null || response.getMetadata() == null || response.getMetadata().getUsage() == null) {
            return;
        }
        Usage usage = response.getMetadata().getUsage();
        long input = usage.getPromptTokens() == null ? 0 : usage.getPromptTokens();
        long output = usage.getCompletionTokens() == null ? 0 : usage.getCompletionTokens();
        int contextTokens = aiLlmProperties.contextTokens();
        log.info("LLM usage model={} inputTokens={} outputTokens={} contextTokens={} cumulativeInput={} cumulativeOutput={}",
            aiLlmProperties.model(), input, output, contextTokens,
            totalInputTokens.addAndGet(input), totalOutputTokens.addAndGet(output));

        // 프롬프트가 창에 가까워지면 다음에 잘린다. 잘림은 오류가 아니라 조용한 품질 저하라
        // 미리 드러내야 한다 - place-candidate-size 를 줄이거나 context-tokens 를 올릴 신호다.
        if (input > contextTokens * CONTEXT_WARN_RATIO) {
            log.warn("LLM prompt is close to the context window promptTokens={} contextTokens={} model={}"
                    + " - lower ai-llm.place-candidate-size or raise ai-llm.context-tokens",
                input, contextTokens, aiLlmProperties.model());
        }
    }

    /**
     * 모델 응답을 도메인 모델로 옮기면서 <b>후보에 없는 장소를 걸러낸다.</b>
     *
     * <p>프롬프트에 "목록 안에서만 고르라"고 적어 두었지만 그것만 믿지 않는다. 규칙을 어기는
     * 일이 드물게 있고, 그때 생기는 결과가 나쁘다 - 존재하지 않는 장소가 일정에 들어가면
     * plan-service 저장 단계에서 터지거나 지도에 찍히지 않는다.
     *
     * <p>걸러낸 항목은 <b>버리지 않고 장소 연결만 끊는다.</b> "카페에서 휴식" 같은 항목 자체는
     * 일정의 흐름으로 쓸모가 있고, 사용자가 직접 장소를 고르면 된다.
     *
     * <p><b>이름이 없는 항목은 반대로 버린다</b> (#487). 모델이 {@code title} 과 {@code note} 를
     * 둘 다 빈 문자열로 둔 {@code MEAL} 항목을 내놓는 일이 있는데, 장소 연결이 끊긴 항목과 달리
     * 이쪽은 <b>남길 것이 하나도 없다</b> — "카페에서 휴식"은 사용자가 장소만 고르면 살아나지만,
     * 이름도 메모도 없는 줄은 무엇을 하라는 것인지 알 방법이 없다. 그대로 두면 화면에 "이름이 없는
     * 항목"으로 그려지고, 담으면 그 빈 줄이 일정에도 남는다.
     *
     * <p>스키마에 {@code @NotBlank} 를 걸지 않고 여기서 거르는 이유는 <b>한 항목 때문에 초안 전체를
     * 잃지 않기 위해서다.</b> {@code BeanOutputConverter} 단계에서 막으면 파싱 실패가 되어
     * {@code LLM_RESPONSE_INVALID} 로 작업이 통째로 죽는데, 나머지 항목은 멀쩡하다.
     * 프롬프트가 1차 방어, 여기가 마지막 방어인 것은 {@link LlmTextCleaner} 와 같은 결이다.
     *
     * <p><b>항목 종류도 같은 이유로 다시 본다.</b> 모델이 {@code WALK} 를 골라 놓고 후보 목록의
     * {@code place.id} 를 실어 보내면 두 아이디 공간이 섞인다 — plan-service 에서 {@code WALK} 의
     * {@code targetId} 는 {@code walk_course.id} 이고, 그 유형은 장소 존재 검증에서 빠지므로
     * <b>틀린 아이디가 조용히 저장된다.</b> {@link #resolveItemType} 이 그것을 맞춘다.
     */
    private AiPlanDraft toDomain(LlmPlanDraftResponse draft, List<PlaceCandidate> candidates) {
        Map<Long, PlaceCandidate> candidateById = candidates.stream()
            .collect(Collectors.toMap(PlaceCandidate::placeId, Function.identity(), (left, right) -> left));
        Set<Long> knownIds = candidateById.keySet();

        List<AiPlanDraftDay> days = new ArrayList<>();
        int hallucinated = 0;
        int nameless = 0;

        for (LlmPlanDraftResponse.LlmPlanDay day : safeList(draft.days())) {
            List<AiPlanDraftItem> items = new ArrayList<>();
            for (LlmPlanDraftResponse.LlmPlanItem item : safeList(day.items())) {
                Long placeId = item.placeId();
                boolean unknownPlace = placeId != null && !knownIds.contains(placeId);
                if (unknownPlace) {
                    hallucinated++;
                    log.warn("LLM returned a place outside the candidate list placeId={} title={}",
                        placeId, item.title());
                }
                PlaceCandidate matched = unknownPlace || placeId == null ? null : candidateById.get(placeId);
                // 후보에 있으면 우리 데이터의 이름을 쓴다. 모델이 이름을 조금씩 바꿔 적는 일이 있다.
                String title = matched != null ? matched.title() : item.title();
                // 내놓을 이름이 없으면 버린다. 판정 기준은 "모델이 비웠는가" 가 아니라 "이름이 남았는가" 다.
                if (isBlank(title)) {
                    nameless++;
                    log.warn("LLM returned an item without a title day={} itemType={} note={} - dropped",
                        day.day(), item.itemType(), item.note());
                    continue;
                }
                items.add(AiPlanDraftItem.builder()
                    .itemType(resolveItemType(item.itemType(), matched))
                    // 후보 밖 장소는 연결만 끊는다. 항목 자체는 일정의 흐름으로 쓸모가 있다.
                    .placeId(matched == null ? null : matched.placeId())
                    .title(title)
                    .note(LlmTextCleaner.clean(item.note()))
                    .build());
            }
            days.add(AiPlanDraftDay.builder().day(day.day()).items(items).build());
        }

        if (hallucinated > 0) {
            log.warn("LLM plan contained {} places outside the candidate list; place links dropped", hallucinated);
        }
        if (nameless > 0) {
            log.warn("LLM plan contained {} items without a title; items dropped", nameless);
        }

        return AiPlanDraft.builder()
            .days(days)
            // 근거 이름·설명과 항목 메모는 사용자에게 그대로 보이는 문장이다 — 준비물 이유와 같은 정리를 거친다.
            .reasons(safeList(draft.reasons()).stream()
                .map(reason -> AiPlanDraftReason.builder()
                    .code(reason.code())
                    .name(LlmTextCleaner.clean(reason.name()))
                    .description(LlmTextCleaner.clean(reason.description()))
                    .build())
                .toList())
            .build();
    }

    /**
     * 항목 종류를 정한다. <b>장소가 실린 항목은 반드시 장소 유형이어야 한다.</b>
     *
     * <p>ai-service 는 산책 코스를 본 적이 없다 — 후보 목록은 tour-service 의 장소뿐이라
     * {@code walk_course.id} 를 알 방법이 없다. 그러므로 <b>장소가 확인된 {@code WALK} 항목은
     * 있을 수 없고</b>, 그것은 유형이 틀린 것이지 아이디가 틀린 것이 아니다 — 아이디는 후보
     * 집합과 대조해 확인했고, 유형은 모델이 자유롭게 적은 값이다.
     *
     * <p>그래서 확인된 쪽을 남기고 유형을 {@code PLACE} 로 바로잡는다. 반대로 아이디를 끊으면
     * 지도 표시와 장소 요약이 함께 사라지는데, "해안 산책로에서 산책"이 실제로 우리 데이터에
     * 있는 장소를 가리키고 있었다면 잃을 이유가 없다. 산책이라는 성격은 {@code title} 과
     * {@code note} 에 그대로 남는다.
     *
     * <p>모르는 코드도 같은 자리에서 접는다. plan-service 의 {@code itemType} 은 enum 이라
     * 모델이 {@code "CAFE"} 처럼 적으면 사용자가 담는 순간 400 이 난다 — 초안을 만든 쪽이
     * 저장 가능한 값만 내려 주는 편이 맞다.
     *
     * @param matched 후보 집합에서 확인된 장소. null 이면 이 항목에 장소가 없다
     */
    private PlanItemType resolveItemType(String code, PlaceCandidate matched) {
        Optional<PlanItemType> parsed = PlanItemType.from(code);
        if (parsed.isEmpty()) {
            log.warn("LLM returned an unknown item type itemType={} falling back to {}", code, DEFAULT_ITEM_TYPE);
            return DEFAULT_ITEM_TYPE;
        }

        PlanItemType itemType = parsed.get();
        if (matched != null && !itemType.isPlaceTarget()) {
            log.warn("LLM put a place on a non-place item type itemType={} placeId={} correcting to {}",
                itemType, matched.placeId(), DEFAULT_ITEM_TYPE);
            return DEFAULT_ITEM_TYPE;
        }
        return itemType;
    }

    private <T> List<T> safeList(List<T> values) {
        return values == null ? List.of() : values;
    }

    /**
     * 내놓을 이름이 없는가. {@code null} · 빈 문자열 · 공백뿐인 값을 모두 같게 본다 — 셋 다 화면에서
     * "보여 줄 이름이 없다"로 똑같이 끝난다.
     */
    private boolean isBlank(String text) {
        return text == null || text.isBlank();
    }
}

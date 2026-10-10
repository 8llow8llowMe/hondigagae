package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.domainlayer.planner.adapter.out.llm.dto.LlmPackingListResponse;
import com.hondigagae.domainlayer.planner.adapter.out.llm.dto.LlmPlanDraftResponse;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
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
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
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
 *   <li><b>환각 방지</b> - 후보 장소에 번호를 붙여 주고 모델은 번호만 적는다. 아이디 · 이름 · 종류는
 *       서버가 그 번호의 후보에서 채우므로 지어낼 자리가 없고, 목록 밖 번호는 버린다 (#1128)</li>
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
     * 초안 근거의 상한. 프롬프트(규칙 4)와 같은 값이다 — 근거는 개요 카드에 한 번 나오는 요약이라 셋이면
     * 충분하고, 하나마다 한 문장씩 디코드 시간이 붙는다 (#1128).
     */
    private static final int MAX_REASONS = 3;

    /**
     * 근거 코드 → 화면 이름. 모델은 이름을 쓰지 않는다 (#1128) — 같은 코드에 매번 다른 이름을 지어 붙이던
     * 자리이고, 그 토큰도 아낀다. 이름은 응답 계약({@code AiPlanReasonItem})이 적어 둔 표시명과 같다.
     */
    private static final Map<String, String> REASON_NAMES = Map.of(
        "PET_ALLOWED", "반려견 동반 가능",
        "WEATHER_OK", "날씨 양호",
        "INDOOR_ALTERNATIVE", "실내 대안",
        "REST_SLOT", "휴식 시간 확보",
        "REQUEST_UNMET", "요청 반영");

    /** 표에 없는 코드의 이름. 코드를 그대로 내보내면 화면에 {@code CAFE_OK} 같은 기호가 보인다. */
    private static final String DEFAULT_REASON_NAME = "추천 이유";

    /** 파싱 실패 때 로그에 남길 응답 원문 길이. 원인을 가르는 데는 앞부분으로 충분하다. */
    private static final int RAW_RESPONSE_LOG_LIMIT = 500;

    /** 프롬프트가 컨텍스트 창의 이 비율을 넘으면 경고한다. 넘어서면 입력이 잘릴 위험 구간이다. */
    private static final double CONTEXT_WARN_RATIO = 0.7d;

    /*
      Ollama 가 응답에 싣는 나노초 지표. Spring AI 의 OllamaChatModel 이 같은 이름으로
      ChatResponseMetadata 에 옮겨 담는다 (상수가 private 이라 여기에 다시 적는다).
      **값은 나노초 숫자가 아니라 java.time.Duration 이다** (Spring AI 1.1.x, #1235) — durationMillis 참고.

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

        AiPlanDraft draft = draftOnce(query, candidates, 1);
        if (hasVisitItem(draft)) {
            return draft;
        }
        /*
         * 모든 날이 비었다 (#1268) — 한 번만 다시 부른다. dev 에서 3일 일정이 출력 144토큰 · 경고 0건으로
         * 세 날 모두 비어 "완료" 된 적이 있다. 형식은 맞고 번호도 틀리지 않았으니 모델이 그 회차에 비워 낸
         * 것이고, 같은 조건으로 다시 부르면 대개 채워진다. 파싱 실패를 다시 부르지 않는 것과 갈리는 자리는
         * ai-service.md "빈 초안은 한 번 다시 부른다" 에 있다. 다시 불러 생긴 예외(타임아웃 · 붐빔)는 그대로
         * 올린다 — 첫 회차에 남길 것이 없다.
         */
        AiPlanDraft retried = draftOnce(query, candidates, 2);
        if (hasVisitItem(retried)) {
            return retried;
        }
        throw new AiPlanException(AiPlanErrorCode.LLM_EMPTY_PLAN);
    }

    /**
     * 모델을 한 번 부르고 가드를 모두 거친 초안을 낸다. 빈 날이 있으면 응답 원문 앞부분과 함께 남긴다 — 왜
     * 비었는지는 원문만 말해 준다.
     */
    private AiPlanDraft draftOnce(AiPlanGenerationQuery query, List<PlaceCandidate> candidates, int attempt) {
        ChatResponse response = request(query);
        String text = extractText(response);
        LlmPlanDraftResponse draft = convertDraft(response, text);
        AiPlanDraft domain = toDomain(draft, query);
        // 번호 → 후보(아이디 · 이름 · 종류) 다음이 사실 대조다. 종류가 정해진 뒤라야 숙박을 가를 수 있다 (#975).
        AiPlanDraft guarded = new AiPlanDraftFactGuard(indexById(candidates), aiPlanPromptFactory.resolveDayCount(query),
            maxTemperatureByDay(query)).apply(domain);
        // 반복 장소는 동선 대조 앞에서 바꾼다 — 바꾼 장소로 구간을 재고 숙소를 옮겨야 한다 (#1254).
        AiPlanDraft deduped = new AiPlanRepeatGuard(candidates).apply(guarded);
        // 동선 대조는 사실 대조 뒤다 — 마지막 날 숙박이 빠진 뒤라야 그날을 숙소를 옮길 밤으로 보지 않는다 (#1171).
        AiPlanDraft routed = AiPlanRouteGuard.of(query).apply(deduped);
        AiPlanDraft limited = limitReasons(routed);
        warnOnEmptyDays(limited, query, response, text, attempt);
        return limited;
    }

    /** 방문 항목(장소 · 식사)이 하나라도 있는가. 숙소만 있는 초안은 일정이 아니다. */
    private static boolean hasVisitItem(AiPlanDraft draft) {
        return safeList(draft.days()).stream().anyMatch(OllamaLlmAdapter::hasVisitItem);
    }

    private static boolean hasVisitItem(AiPlanDraftDay day) {
        return safeList(day.items()).stream().anyMatch(item ->
            item.itemType() == PlanItemType.PLACE || item.itemType() == PlanItemType.MEAL);
    }

    /**
     * 방문 항목이 없는 날을 남긴다 — 빠진 날도 센다. 전부 비면 다시 부르기 직전이고, 일부만 비면 초안을 그대로
     * 내고 화면이 그날을 안내한다(#1270). 어느 쪽이든 원문이 있어야 원인을 가른다.
     */
    private void warnOnEmptyDays(AiPlanDraft draft, AiPlanGenerationQuery query, ChatResponse response, String text,
                                 int attempt) {
        List<Integer> expectedDays = query.regenerateDay() != null
            ? List.of(query.regenerateDay())
            : IntStream.rangeClosed(1, aiPlanPromptFactory.resolveDayCount(query)).boxed().toList();
        Set<Integer> madeDays = safeList(draft.days()).stream()
            .filter(OllamaLlmAdapter::hasVisitItem)
            .map(AiPlanDraftDay::day)
            .collect(Collectors.toSet());
        List<Integer> emptyDays = expectedDays.stream().filter(day -> !madeDays.contains(day)).toList();
        if (emptyDays.isEmpty()) {
            return;
        }
        log.warn("AI plan draft has days without a visit item attempt={} emptyDays={} of={} finishReason={} rawHead={}",
            attempt, emptyDays, expectedDays.size(), finishReasonOf(response), head(text));
    }

    /**
     * 근거를 {@value #MAX_REASONS} 개로 자른다. <b>사실 대조 뒤에 자른다</b> — 앞에서 자르면 확인할 수 없어 빠질
     * 근거(거리 · 혼잡)가 자리를 차지해 맞는 근거가 셋보다 적게 남는다. 모델이 앞에 둔 것을 남긴다.
     */
    private AiPlanDraft limitReasons(AiPlanDraft draft) {
        List<AiPlanDraftReason> reasons = safeList(draft.reasons());
        if (reasons.size() <= MAX_REASONS) {
            return draft;
        }
        log.info("LLM plan carried more reasons than allowed count={} max={} - trimmed", reasons.size(), MAX_REASONS);
        return AiPlanDraft.builder().days(draft.days()).reasons(List.copyOf(reasons.subList(0, MAX_REASONS))).build();
    }

    private Map<Long, PlaceCandidate> indexById(List<PlaceCandidate> candidates) {
        return candidates.stream()
            .collect(Collectors.toMap(PlaceCandidate::placeId, Function.identity(), (left, right) -> left));
    }

    /**
     * 일차 → 그날 최고기온. 전망이 없거나 최고기온을 모르는 날은 담지 않는다 — "모른다" 를 "덥지 않다" 와
     * 섞지 않고, 둘 다 "더위를 말할 근거가 없다" 로 같게 다룬다.
     */
    private Map<Integer, Double> maxTemperatureByDay(AiPlanGenerationQuery query) {
        LocalDate start;
        try {
            start = LocalDate.parse(query.startDate());
        } catch (RuntimeException exception) {
            return Map.of();
        }
        Map<Integer, Double> byDay = new LinkedHashMap<>();
        for (DayWeatherOutlook outlook : query.safeWeatherOutlook()) {
            if (outlook.date() != null && outlook.maxTemperature() != null) {
                byDay.put((int) ChronoUnit.DAYS.between(start, outlook.date()) + 1, outlook.maxTemperature());
            }
        }
        return byDay;
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
        List<PackingList.PackingItem> modelItems = packing.items() == null ? List.of()
            : packing.items().stream()
                .filter(item -> item.name() != null && !item.name().isBlank())
                .map(item -> PackingList.PackingItem.builder()
                    .category(item.category())
                    .name(item.name())
                    // 이유는 화면의 본문이다. 프롬프트 표기([N일차])가 새면 여기서 걷어낸다 (#233).
                    .reason(LlmTextCleaner.clean(item.reason()))
                    .build())
                .toList();
        // 기본 품목 · 날씨 품목은 서버가 정하고, 모델 품목은 목록 안의 조건부 품목만 받는다 (#976).
        return PackingList.builder().items(new PackingListRules(query).apply(modelItems)).build();
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

    /**
     * 단위 없는 정수 문자열은 초 단위({@code s})를 붙여 보낸다 (#1321). Ollama 는 문자열 keep_alive 에서 단위가 없으면
     * HTTP 400({@code time: missing unit in duration "-1"})으로 거부한다(dev 2026-10-10 실측). Spring AI 는 값을 문자열로
     * 보내므로 {@code -1} 을 그대로 두면 모든 생성이 실패한다. 숫자 keep_alive 는 초 단위이고 음수는 상주라 뜻이 같다.
     * 단위 있는 값({@code -1m} · {@code 24h} · {@code 30m})은 그대로 보낸다. 비면 기존 동작(값 그대로).
     */
    static String ollamaKeepAlive(String keepAlive) {
        if (keepAlive == null) {
            return null;
        }
        String trimmed = keepAlive.trim();
        return trimmed.matches("-?\\d+") ? trimmed + "s" : trimmed;
    }

    private OllamaChatOptions buildRequestOptions() {
        OllamaChatOptions.Builder builder = OllamaChatOptions.builder().format("json")
            // 요청마다 싣는다 — Ollama 의 keep_alive 는 요청 단위 값이라, 빠뜨린 요청 하나가 서버 기본(5분)으로
            // 되돌려 놓는다. 그러면 뜸한 dev 에서 첫 요청마다 모델 로드가 붙는다 (#1128).
            .keepAlive(ollamaKeepAlive(aiLlmProperties.keepAlive()));
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
    private LlmPlanDraftResponse convertDraft(ChatResponse response, String text) {
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
     *   <li>{@code unreportedMs} 가 크다 → Ollama 가 지표에 싣지 않은 구간이다. <b>입력 처리 추정이 아니다</b> (#1321).
     *       요청이 {@code format:"json"} + {@code think:"low"} 라 Ollama 는 추론을 먼저 생성하고(첫 단계) 문법을 걸어
     *       다시 생성하는데, 첫 단계 시간(추론 토큰 생성 + 캐시가 안 맞을 때의 입력 처리)은
     *       {@code prompt_eval_duration} · {@code eval_duration} 어디에도 없다. 그래서
     *       {@code unreportedMs = totalMs - loadMs - decodeMs} 는 추론 길이를 따라 흔들린다(700~1,800자에 시간도 같이).
     *       {@code prefillMs}(보고값)도 이 구간을 포함하지 않으므로 입력 길이와 무관하게 작게 나온다 (#1246)</li>
     *   <li>{@code decodeMs} 가 크다 → 출력이 길거나 장비가 느리다. 프롬프트를 줄여도 거의 그대로다</li>
     *   <li>{@code loadMs} 가 0 이 아니다 → 모델이 내려갔다 다시 올라왔다. {@code ai-llm.keep-alive} 를 본다</li>
     *   <li>{@code elapsedMs} 와 {@code totalMs} 차이가 크다 → 대기·전송이 끼었다.
     *       {@code OLLAMA_NUM_PARALLEL=1} 이라 다른 요청을 기다린 것일 수 있다 (#508)</li>
     * </ul>
     *
     * <p><b>지표가 없어도 조용히 넘어간다.</b> provider 를 바꾸면 이 키들이 없다 — 계측이
     * 생성을 막으면 안 된다.
     */
    private void logTiming(String operation, Prompt prompt, ChatResponse response, long elapsedMs) {
        Long totalMs = durationMillis(response, METADATA_TOTAL_DURATION);
        Long loadMs = durationMillis(response, METADATA_LOAD_DURATION);
        Long decodeMs = durationMillis(response, METADATA_EVAL_DURATION);
        Long unreportedMs = totalMs == null || loadMs == null || decodeMs == null ? null : totalMs - loadMs - decodeMs;
        log.info("LLM timing operation={} model={} promptChars={} elapsedMs={} totalMs={} loadMs={}"
                + " prefillMs={} unreportedMs={} decodeMs={} outputTokens={}",
            operation, aiLlmProperties.model(), promptChars(prompt), elapsedMs, totalMs, loadMs,
            durationMillis(response, METADATA_PROMPT_EVAL_DURATION), unreportedMs, decodeMs,
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
        /*
          Spring AI 1.1.x 의 OllamaChatModel 은 Ollama 가 준 나노초를 Duration 으로 바꿔 싣는다 (#1235). 전에는
          나노초 숫자만 읽어 dev 에서 단계별 시간이 전부 null 이었다 — 테스트가 숫자를 넣어 통과했다.
          숫자 나노초는 다른 버전 호환으로 남긴다. 다른 provider 는 이 키가 아예 없다.
        */
        if (raw instanceof Duration duration) {
            return duration.toMillis();
        }
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
     * 모델 응답을 도메인 모델로 옮긴다. <b>모델이 적은 것은 후보 번호와 메모뿐이고, 나머지는 서버가 후보에서
     * 채운다</b> (#1128).
     *
     * <ul>
     *   <li><b>번호 → 후보.</b> {@code place} 는 프롬프트 후보 목록({@code query.safeCandidates()} 순서)의
     *       1부터 시작하는 번호다. 아이디 · 이름은 그 후보의 값이다 — 모델이 이름을 조금씩 바꿔 적거나 18자리
     *       아이디를 옮기다 틀릴 자리가 애초에 없다</li>
     *   <li><b>번호가 없거나 목록 밖이면 항목을 버린다.</b> 전에는 장소 연결만 끊고 모델이 적은 이름으로
     *       남겼지만, 이제 이름을 모델이 쓰지 않으므로 남길 것이 없다 — 이름도 장소도 없는 줄은 화면에
     *       "이름이 없는 항목" 으로 그려지고 담으면 일정에도 남는다(#487 과 같은 결과). 한 항목 때문에 초안
     *       전체를 잃지 않도록 스키마에서 막지 않고 여기서 거른다</li>
     *   <li><b>종류는 후보 분류로 정한다</b> ({@link #itemTypeOf}). 모델이 종류를 고르던 때는 {@code WALK} 에
     *       {@code place.id} 를 실어 두 아이디 공간이 섞이거나(#89) 콘도를 {@code PLACE} 로 적는 일(#975)을
     *       뒤에서 바로잡아야 했다. 초안에는 {@code PLACE} · {@code MEAL} · {@code LODGING} 만 나온다</li>
     *   <li><b>숙소는 그날의 {@code lodging} 번호로 받아 그날 끝에 붙인다</b> ({@link #appendLodging}). 같은
     *       숙소에 이어 묵을 때 항목 · 메모를 날마다 다시 쓰게 하지 않으려는 것이다. 마지막 날 숙박을 빼는
     *       규칙은 {@link AiPlanDraftFactGuard} 하나가 갖는다</li>
     *   <li><b>하루 재생성이면 대상 일자만 남긴다</b> ({@link #targetDays}). 화면은 그날만 쓴다</li>
     *   <li><b>근거 이름은 코드로 서버가 채운다</b> ({@link #reasonName})</li>
     * </ul>
     */
    private AiPlanDraft toDomain(LlmPlanDraftResponse draft, AiPlanGenerationQuery query) {
        List<PlaceCandidate> candidates = query.safeCandidates();
        Map<Long, PlaceCandidate> candidateById = indexById(candidates);

        // 조사 교정이 쓸 이름. 후보 이름만 우리가 아는 이름이다.
        List<String> candidateTitles = candidates.stream().map(PlaceCandidate::title).toList();

        List<AiPlanDraftDay> days = new ArrayList<>();
        int dropped = 0;
        /*
         * 일자 간 장소 중복 감지 (#570). 1일차·2일차가 둘 다 `애월한담공원` 으로 시작한 적이 있다.
         * **숙소는 세지 않는다** — 같은 곳에 이어 묵는 것이 정상이고, 그건 결과 항목의
         * `itemType == LODGING` 으로 갈린다. 그 값은 itemTypeOf 가 후보의 contentTypeName(숙박)으로 정한다.
         */
        Map<Long, Set<Integer>> nonLodgingPlaceDays = new LinkedHashMap<>();

        for (LlmPlanDraftResponse.LlmPlanDay day : targetDays(safeList(draft.days()), query.regenerateDay())) {
            List<AiPlanDraftItem> items = new ArrayList<>();
            for (LlmPlanDraftResponse.LlmPlanItem item : safeList(day.items())) {
                PlaceCandidate matched = candidateAt(candidates, item.place());
                if (matched == null) {
                    dropped++;
                    log.warn("LLM returned an item without a valid candidate number day={} place={} candidates={} note={} - dropped",
                        day.day(), item.place(), candidates.size(), item.note());
                    continue;
                }
                PlanItemType itemType = itemTypeOf(matched);
                if (itemType != PlanItemType.LODGING) {
                    nonLodgingPlaceDays
                        .computeIfAbsent(matched.placeId(), ignored -> new LinkedHashSet<>())
                        .add(day.day());
                }

                items.add(AiPlanDraftItem.builder()
                    .itemType(itemType)
                    .placeId(matched.placeId())
                    .title(matched.title())
                    .note(cleanUserFacing(item.note(), candidateTitles))
                    .build());
            }
            appendLodging(items, day, candidates);
            days.add(AiPlanDraftDay.builder().day(day.day()).items(items).build());
        }

        if (dropped > 0) {
            log.warn("LLM plan contained {} items without a valid candidate number; items dropped", dropped);
        }
        warnOnRepeatedPlaces(nonLodgingPlaceDays, candidateById);

        return AiPlanDraft.builder()
            .days(days)
            // 근거 설명과 항목 메모는 사용자에게 그대로 보이는 문장이다 — 준비물 이유와 같은 정리를 거친다.
            .reasons(safeList(draft.reasons()).stream()
                .map(reason -> AiPlanDraftReason.builder()
                    .code(reason.code())
                    .name(reasonName(reason.code()))
                    .description(cleanUserFacing(reason.description(), candidateTitles))
                    .build())
                .toList())
            .build();
    }

    /**
     * 프롬프트의 후보 번호를 후보로 되돌린다. 번호는 {@code safeCandidates()} 순서의 1부터 시작하는 인덱스다 —
     * 프롬프트({@code AiPlanPromptFactory#userPrompt})가 같은 목록 순서로 매긴다. 없거나 범위 밖이면 null 이다.
     */
    private static PlaceCandidate candidateAt(List<PlaceCandidate> candidates, Integer number) {
        if (number == null || number < 1 || number > candidates.size()) {
            return null;
        }
        return candidates.get(number - 1);
    }

    /**
     * 항목 종류. <b>후보 분류가 정한다</b> — 숙박은 {@code LODGING}, 음식점은 {@code MEAL}, 그 밖은 {@code PLACE}.
     *
     * <p>셋 다 {@code targetId} 가 {@code place.id} 인 유형이라({@link PlanItemType#isPlaceTarget}) 후보 아이디와
     * 뜻이 어긋나지 않는다. {@code WALK} 는 나오지 않는다 — 그 {@code targetId} 는 {@code walk_course.id} 인데
     * ai-service 는 산책 코스 후보를 본 적이 없다. 산책이라는 성격은 메모에 남는다.
     */
    private static PlanItemType itemTypeOf(PlaceCandidate candidate) {
        if (AiPlanDraftFactGuard.LODGING_CONTENT_TYPE.equals(candidate.contentTypeName())) {
            return PlanItemType.LODGING;
        }
        if (AiPlanDraftFactGuard.RESTAURANT_CONTENT_TYPE.equals(candidate.contentTypeName())) {
            return PlanItemType.MEAL;
        }
        return PlanItemType.PLACE;
    }

    /**
     * 그날의 {@code lodging} 번호를 그날 끝의 숙박 항목으로 펼친다. 메모는 서버 문구다 — 모델은 숙소 메모를 쓰지 않는다.
     *
     * <ul>
     *   <li><b>숙박 후보가 아니면 붙이지 않는다.</b> 카페 번호를 적었다고 카페에서 묵는 일정을 만들 수는 없다</li>
     *   <li><b>그날 마지막 항목이 이미 같은 숙소면 붙이지 않는다.</b> 규칙을 어기고 숙소를 항목에도 적은 경우다</li>
     *   <li><b>마지막 날인지는 보지 않는다.</b> 그날 숙박을 빼는 것은 {@link AiPlanDraftFactGuard} 의 규칙이고,
     *       여기서도 빼면 규칙의 주인이 둘이 된다</li>
     * </ul>
     */
    private void appendLodging(List<AiPlanDraftItem> items, LlmPlanDraftResponse.LlmPlanDay day, List<PlaceCandidate> candidates) {
        if (day.lodging() == null) {
            return;
        }
        PlaceCandidate stay = candidateAt(candidates, day.lodging());
        if (stay == null) {
            log.warn("LLM lodging number is outside the candidate list day={} lodging={} candidates={} - ignored",
                day.day(), day.lodging(), candidates.size());
            return;
        }
        if (itemTypeOf(stay) != PlanItemType.LODGING) {
            log.warn("LLM lodging number points to a non-lodging candidate day={} lodging={} placeId={} contentType={} - ignored",
                day.day(), day.lodging(), stay.placeId(), stay.contentTypeName());
            return;
        }
        if (!items.isEmpty() && Long.valueOf(stay.placeId()).equals(items.get(items.size() - 1).placeId())) {
            return;
        }
        items.add(AiPlanDraftItem.builder()
            .itemType(PlanItemType.LODGING)
            .placeId(stay.placeId())
            .title(stay.title())
            .note(AiPlanDraftFactGuard.LODGING_NOTE)
            .build());
    }

    /**
     * 하루 재생성이면 대상 일자만 남긴다. 전체 생성({@code regenerateDay == null})은 그대로다.
     *
     * <p>프롬프트가 "그날 하루만 출력할 것" 이라고 시키지만 그것만 믿지 않는다 — 다른 날이 섞여 오면 담기 화면은
     * 어차피 그날만 쓰고, 나머지는 응답만 키운다. 모델이 하루만 냈는데 번호가 다르면 그것이 대상 일자의 답이다 —
     * 번호를 바로잡는다. 여러 날을 냈는데 대상 일자가 없으면 고를 근거가 없어 비운다(화면은 "그날이 없다" 로 실패를
     * 알린다 — 빈 일자와 뜻이 다르다).
     */
    private List<LlmPlanDraftResponse.LlmPlanDay> targetDays(List<LlmPlanDraftResponse.LlmPlanDay> days, Integer regenerateDay) {
        if (regenerateDay == null) {
            return days;
        }
        Optional<LlmPlanDraftResponse.LlmPlanDay> target = days.stream().filter(day -> day.day() == regenerateDay).findFirst();
        if (target.isPresent()) {
            if (days.size() > 1) {
                log.warn("LLM regenerate response carried other days target={} returnedDays={} - kept the target day only",
                    regenerateDay, days.size());
            }
            return List.of(target.get());
        }
        if (days.size() == 1) {
            LlmPlanDraftResponse.LlmPlanDay only = days.get(0);
            log.warn("LLM regenerate response numbered the day differently day={} target={} - renumbered", only.day(), regenerateDay);
            return List.of(new LlmPlanDraftResponse.LlmPlanDay(regenerateDay, only.items(), only.lodging()));
        }
        log.warn("LLM regenerate response has no target day target={} returnedDays={} - no day kept", regenerateDay, days.size());
        return List.of();
    }

    /** 근거 코드의 화면 이름. 표에 없는 코드는 일반 이름으로 — 모르는 코드를 그대로 보여 주지 않는다. */
    private static String reasonName(String code) {
        if (code == null || code.isBlank()) {
            return DEFAULT_REASON_NAME;
        }
        return REASON_NAMES.getOrDefault(code.trim().toUpperCase(Locale.ROOT), DEFAULT_REASON_NAME);
    }

    /**
     * 사용자에게 그대로 보이는 문장을 정리한다. 표기 정리({@link LlmTextCleaner}) 뒤에 장소명 조사를
     * 바로잡는다({@link KoreanParticleFixer}) — 순서가 중요하다. 대괄호를 먼저 걷어내야
     * {@code "[애월코스트34]은"} 의 조사가 장소명 바로 뒤에 놓인다.
     */
    private String cleanUserFacing(String text, List<String> candidateTitles) {
        return KoreanParticleFixer.fix(LlmTextCleaner.clean(text), candidateTitles);
    }

    /**
     * 같은 장소가 여러 날에 걸쳐 있으면 남긴다 (#570).
     *
     * <p><b>항목을 지우지 않는다.</b> 지우면 그 일자에 구멍이 나고, 무엇으로 메울지는 여기서 알 수
     * 없다. 프롬프트가 1차 방어이고 여기는 <b>재발을 세는 자리</b>다 — 로그가 계속 길어지면 프롬프트가
     * 아니라 후보 풀(전 기간 공통 50곳)을 일자별로 나누는 쪽이 원인이라는 뜻이다.
     */
    private void warnOnRepeatedPlaces(Map<Long, Set<Integer>> placeDays, Map<Long, PlaceCandidate> candidateById) {
        placeDays.forEach((placeId, dayNumbers) -> {
            if (dayNumbers.size() < 2) {
                return;
            }
            PlaceCandidate candidate = candidateById.get(placeId);
            log.warn("LLM placed the same place on multiple days placeId={} title={} days={}",
                placeId, candidate == null ? null : candidate.title(), dayNumbers);
        });
    }

    private static <T> List<T> safeList(List<T> values) {
        return values == null ? List.of() : values;
    }
}

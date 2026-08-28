package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.domainlayer.planner.adapter.out.llm.dto.LlmPlanDraftResponse;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.port.out.AiLlmPort;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftDay;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftItem;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftReason;
import com.hondigagae.global.properties.AiLlmProperties;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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
@ConditionalOnProperty(prefix = "ai-llm", name = "enabled", havingValue = "true")
public class OllamaLlmAdapter implements AiLlmPort {

    /** 서킷 인스턴스명. provider 와 무관한 단일 인스턴스다 (coding-conventions §10). */
    public static final String CIRCUIT_NAME = "llm";

    private final OllamaChatModel ollamaChatModel;
    private final AiPlanPromptFactory aiPlanPromptFactory;
    private final AiLlmProperties aiLlmProperties;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    private final BeanOutputConverter<LlmPlanDraftResponse> outputConverter =
        new BeanOutputConverter<>(LlmPlanDraftResponse.class);

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

    private ChatResponse request(AiPlanGenerationQuery query) {
        // 스키마 지시를 사용자 프롬프트 끝에 싣는다. Anthropic SDK 의 outputConfig 가 하던
        // 스키마 강제를 provider 중립으로 옮긴 자리다 — format=json 이 "JSON 만" 을 강제하고,
        // 이 지시가 "어떤 JSON 인지" 를 강제한다.
        String userPrompt = aiPlanPromptFactory.userPrompt(query)
            + "\n\n" + outputConverter.getFormat();

        Prompt prompt = new Prompt(
            List.of(new SystemMessage(aiPlanPromptFactory.systemPrompt()), new UserMessage(userPrompt)),
            buildRequestOptions());

        try {
            return circuitBreakerRegistry.circuitBreaker(CIRCUIT_NAME)
                .executeSupplier(() -> ollamaChatModel.call(prompt));
        } catch (CallNotPermittedException exception) {
            log.warn("LLM circuit open, skipping call");
            throw new AiPlanException(AiPlanErrorCode.LLM_UNAVAILABLE, exception);
        } catch (AiPlanException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            log.error("LLM call failed model={} reason={}", aiLlmProperties.model(), exception.getMessage(), exception);
            throw new AiPlanException(AiPlanErrorCode.LLM_UNAVAILABLE, exception);
        }
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

        try {
            return outputConverter.convert(text);
        } catch (RuntimeException exception) {
            log.error("LLM 응답을 스키마로 해석할 수 없습니다. model={} reason={}",
                aiLlmProperties.model(), exception.getMessage());
            throw new AiPlanException(AiPlanErrorCode.LLM_RESPONSE_INVALID, exception);
        }
    }

    private void recordUsage(ChatResponse response) {
        if (response == null || response.getMetadata() == null || response.getMetadata().getUsage() == null) {
            return;
        }
        Usage usage = response.getMetadata().getUsage();
        long input = usage.getPromptTokens() == null ? 0 : usage.getPromptTokens();
        long output = usage.getCompletionTokens() == null ? 0 : usage.getCompletionTokens();
        log.info("LLM usage model={} inputTokens={} outputTokens={} cumulativeInput={} cumulativeOutput={}",
            aiLlmProperties.model(), input, output,
            totalInputTokens.addAndGet(input), totalOutputTokens.addAndGet(output));
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
     */
    private AiPlanDraft toDomain(LlmPlanDraftResponse draft, List<PlaceCandidate> candidates) {
        Map<Long, PlaceCandidate> candidateById = candidates.stream()
            .collect(Collectors.toMap(PlaceCandidate::placeId, Function.identity(), (left, right) -> left));
        Set<Long> knownIds = candidateById.keySet();

        List<AiPlanDraftDay> days = new ArrayList<>();
        int hallucinated = 0;

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
                items.add(AiPlanDraftItem.builder()
                    .itemType(item.itemType())
                    // 후보 밖 장소는 연결만 끊는다. 항목 자체는 일정의 흐름으로 쓸모가 있다.
                    .placeId(matched == null ? null : matched.placeId())
                    // 후보에 있으면 우리 데이터의 이름을 쓴다. 모델이 이름을 조금씩 바꿔 적는 일이 있다.
                    .title(matched != null ? matched.title() : item.title())
                    .note(item.note())
                    .build());
            }
            days.add(AiPlanDraftDay.builder().day(day.day()).items(items).build());
        }

        if (hallucinated > 0) {
            log.warn("LLM plan contained {} places outside the candidate list; place links dropped", hallucinated);
        }

        return AiPlanDraft.builder()
            .days(days)
            .reasons(safeList(draft.reasons()).stream()
                .map(reason -> AiPlanDraftReason.builder()
                    .code(reason.code())
                    .name(reason.name())
                    .description(reason.description())
                    .build())
                .toList())
            .build();
    }

    private <T> List<T> safeList(List<T> values) {
        return values == null ? List.of() : values;
    }
}

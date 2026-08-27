package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.anthropic.client.AnthropicClient;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessage;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import com.anthropic.models.messages.ThinkingConfigAdaptive;
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
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Claude 기반 일정 생성 어댑터.
 *
 * <p>{@code StubLlmAdapter} 를 대신하는 실제 구현이다. provider 세부사항은 전부 이 클래스
 * 안에 있고, application 계층은 {@link AiLlmPort} 와 {@link AiPlanDraft} 만 안다.
 *
 * <p>설계에서 신경 쓴 지점 넷:
 * <ul>
 *   <li><b>구조화 출력</b> - 스키마({@link LlmPlanDraftResponse})로 응답 형태를 강제한다.
 *       모델이 낸 문자열을 정규식으로 뜯는 코드가 없다</li>
 *   <li><b>환각 방지</b> - 후보 장소를 프롬프트로 주고, 돌아온 placeId 를 다시 후보 집합과
 *       대조한다. 프롬프트만으로는 부족하다 - 규칙을 어기는 일이 드물게 있다</li>
 *   <li><b>서킷</b> - 인스턴스 {@code llm}. 정상 응답이 수십 초라 slow-call 임계를 따로 완화해 둔다</li>
 *   <li><b>토큰 카운터</b> - 운영 비용을 추적한다 (services/ai-service.md)</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "ai-llm", name = "enabled", havingValue = "true")
public class AnthropicClaudeLlmAdapter implements AiLlmPort {

    /** 서킷 인스턴스명. provider 와 무관한 단일 인스턴스다 (coding-conventions §10). */
    public static final String CIRCUIT_NAME = "llm";

    private static final String REFUSAL_STOP_REASON = "refusal";

    private final AnthropicClient anthropicClient;
    private final AiPlanPromptFactory aiPlanPromptFactory;
    private final AiLlmProperties aiLlmProperties;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    /** 누적 토큰 사용량. 운영 비용 추적용이라 프로세스 수명 동안만 유지한다. */
    private final AtomicLong totalInputTokens = new AtomicLong();
    private final AtomicLong totalOutputTokens = new AtomicLong();

    @Override
    public AiPlanDraft generatePlanDraft(AiPlanGenerationQuery query) {
        List<PlaceCandidate> candidates = query.safeCandidates();
        if (candidates.isEmpty()) {
            // 후보가 없는데 생성을 시키면 모델이 기억으로 장소를 지어낸다. 차라리 실패시킨다.
            throw new AiPlanException(AiPlanErrorCode.NO_PLACE_CANDIDATES);
        }

        StructuredMessage<LlmPlanDraftResponse> message = request(query);
        LlmPlanDraftResponse draft = extractDraft(message);
        return toDomain(draft, candidates);
    }

    private StructuredMessage<LlmPlanDraftResponse> request(AiPlanGenerationQuery query) {
        StructuredMessageCreateParams<LlmPlanDraftResponse> params = MessageCreateParams.builder()
            .model(aiLlmProperties.model())
            .maxTokens(aiLlmProperties.maxTokens())
            // 일정 설계는 제약이 여럿 얽히는 작업이라 적응형 사고를 켠다.
            .thinking(ThinkingConfigAdaptive.builder().build())
            .system(aiPlanPromptFactory.systemPrompt())
            .outputConfig(LlmPlanDraftResponse.class)
            .addUserMessage(aiPlanPromptFactory.userPrompt(query))
            .build();

        try {
            return circuitBreakerRegistry.circuitBreaker(CIRCUIT_NAME)
                .executeSupplier(() -> anthropicClient.messages().create(params));
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

    /**
     * 응답에서 일정안을 꺼내고 사용량을 기록한다.
     *
     * <p>거절(refusal)을 먼저 본다. 거절은 HTTP 200 으로 오기 때문에 content 를 그냥 읽으면
     * 비어 있는 응답을 파싱 실패로 오해하게 된다 - 원인이 전혀 다르고 사용자에게 할 말도 다르다.
     */
    private LlmPlanDraftResponse extractDraft(StructuredMessage<LlmPlanDraftResponse> message) {
        recordUsage(message);

        boolean refused = message.stopReason()
            .map(stopReason -> REFUSAL_STOP_REASON.equalsIgnoreCase(stopReason.toString()))
            .orElse(false);
        if (refused) {
            log.warn("LLM refused the request stopReason=refusal");
            throw new AiPlanException(AiPlanErrorCode.LLM_REFUSED);
        }

        return message.content().stream()
            .flatMap(block -> block.text().stream())
            .map(textBlock -> textBlock.text())
            .filter(Objects::nonNull)
            .findFirst()
            .orElseThrow(() -> {
                log.error("LLM response carried no structured content stopReason={}", message.stopReason());
                return new AiPlanException(AiPlanErrorCode.LLM_RESPONSE_INVALID);
            });
    }

    private void recordUsage(StructuredMessage<LlmPlanDraftResponse> message) {
        long input = message.usage().inputTokens();
        long output = message.usage().outputTokens();
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

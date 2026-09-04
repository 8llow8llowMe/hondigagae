package com.hondigagae.domainlayer.planner.domain.model;

import java.util.List;
import com.hondigagae.shared.travel.plan.PlanItemType;
import lombok.Builder;

/**
 * LLM이 생성한 여행 일정 초안(domain model).
 *
 * <p>일정의 소유권은 plan-service에 있다. 이 모델은 "제안(draft)"이며, 사용자가 확정하면
 * plan-service 저장 API를 통해 정식 일정이 된다 (services/ai-service.md).
 *
 * <p>{@code AiLlmPort}의 반환 타입이라 application 계층 타입(Info)을 쓰지 않는다.
 * 응답 조립용 {@code AiPlanDraftInfo} 변환은 이 모델을 받은 뒤 application 계층에서 수행한다.
 */
@Builder
public record AiPlanDraft(
    List<AiPlanDraftDay> days,
    List<AiPlanDraftReason> reasons
) {

    @Builder
    public record AiPlanDraftDay(
        int day,
        List<AiPlanDraftItem> items
    ) {

    }

    /**
     * 초안의 일정 항목.
     *
     * <p><b>{@code itemType} 과 {@code placeId} 는 따로 볼 수 없다.</b> {@code placeId} 는
     * plan-service 에서 {@code targetId} 가 되는데, 그 값이 {@code place.id} 인지
     * {@code walk_course.id} 인지를 {@code itemType} 이 정하기 때문이다
     * ({@link PlanItemType} 의 아이디 공간 참고). 어댑터가 둘을 맞춰 놓고 여기로 넘긴다.
     */
    @Builder
    public record AiPlanDraftItem(
        // 항목 종류. plan-service 와 같은 enum 을 쓴다 - 문자열로 두면 코드가 조용히 어긋난다.
        PlanItemType itemType,
        // 장소 식별자. plan-service 저장 시 targetId 가 된다.
        // 이동(MOVE)처럼 특정 장소가 없거나, 후보 밖 장소라 연결을 끊은 경우 null 이다.
        Long placeId,
        String title,
        String note
    ) {

    }

    /**
     * XAI 추천 이유 (api-design-guide §9). 데이터 근거를 코드에서 조립하고 문장화만 LLM에 맡기는 방향을 우선한다.
     */
    @Builder
    public record AiPlanDraftReason(
        String code,
        String name,
        String description
    ) {

    }
}

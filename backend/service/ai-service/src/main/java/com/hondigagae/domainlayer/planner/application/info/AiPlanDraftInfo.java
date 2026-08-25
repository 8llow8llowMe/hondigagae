package com.hondigagae.domainlayer.planner.application.info;

import java.util.List;
import lombok.Builder;

/**
 * AI가 생성한 여행 일정 초안.
 *
 * <p>일정의 소유권은 plan-service에 있다. 이 모델은 "제안(draft)"이며,
 * 사용자가 확정하면 plan-service 저장 API를 통해 정식 일정이 된다 (services/ai-service.md).
 */
@Builder
public record AiPlanDraftInfo(
    List<AiPlanDayInfo> days,
    List<AiPlanReasonInfo> reasons
) {

    @Builder
    public record AiPlanDayInfo(
        int day,
        List<AiPlanItemInfo> items
    ) {

    }

    @Builder
    public record AiPlanItemInfo(
        // 일정 항목 종류 코드 (PLACE/MEAL/LODGING/WALK/MOVE) — plan-service의 PlanItemType과 코드 문자열을 맞춘다.
        String itemType,
        String title,
        String note
    ) {

    }

    /**
     * XAI 추천 이유 (api-design-guide §9). 데이터 근거를 코드에서 조립하고 문장화만 LLM에 맡기는 방향을 우선한다.
     */
    @Builder
    public record AiPlanReasonInfo(
        String code,
        String name,
        String description
    ) {

    }
}

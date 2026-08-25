package com.hondigagae.domainlayer.planner.domain.model;

import java.util.List;
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

    @Builder
    public record AiPlanDraftItem(
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
    public record AiPlanDraftReason(
        String code,
        String name,
        String description
    ) {

    }
}

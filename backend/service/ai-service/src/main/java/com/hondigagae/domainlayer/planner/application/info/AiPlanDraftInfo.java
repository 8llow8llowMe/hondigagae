package com.hondigagae.domainlayer.planner.application.info;

import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import java.util.List;
import lombok.Builder;

/**
 * AI가 생성한 여행 일정 초안의 application 표현.
 *
 * <p>{@link AiPlanDraft}(domain model)를 Presenter가 쓰기 좋은 모양으로 옮긴 것이며,
 * {@code AiPlanJob}의 필드로 Redis에 함께 저장된다.
 */
@Builder
public record AiPlanDraftInfo(
    List<AiPlanDayInfo> days,
    List<AiPlanReasonInfo> reasons
) {

    public static AiPlanDraftInfo from(AiPlanDraft draft) {
        if (draft == null) {
            return null;
        }
        List<AiPlanDayInfo> days = draft.days() == null ? List.of()
            : draft.days().stream().map(AiPlanDayInfo::from).toList();
        List<AiPlanReasonInfo> reasons = draft.reasons() == null ? List.of()
            : draft.reasons().stream().map(AiPlanReasonInfo::from).toList();

        return AiPlanDraftInfo.builder()
            .days(days)
            .reasons(reasons)
            .build();
    }

    @Builder
    public record AiPlanDayInfo(
        int day,
        List<AiPlanItemInfo> items
    ) {

        public static AiPlanDayInfo from(AiPlanDraft.AiPlanDraftDay day) {
            List<AiPlanItemInfo> items = day.items() == null ? List.of()
                : day.items().stream().map(AiPlanItemInfo::from).toList();
            return AiPlanDayInfo.builder().day(day.day()).items(items).build();
        }
    }

    @Builder
    public record AiPlanItemInfo(
        // 일정 항목 종류 코드 (PLACE/MEAL/LODGING/WALK/MOVE) — plan-service의 PlanItemType과 코드 문자열을 맞춘다.
        String itemType,
        // 장소 식별자. 후보 목록에서 확인된 장소만 채운다.
        Long placeId,
        String title,
        String note
    ) {

        public static AiPlanItemInfo from(AiPlanDraft.AiPlanDraftItem item) {
            return AiPlanItemInfo.builder()
                .itemType(item.itemType())
                .placeId(item.placeId())
                .title(item.title())
                .note(item.note())
                .build();
        }
    }

    /**
     * XAI 추천 이유 (api-design-guide §9).
     */
    @Builder
    public record AiPlanReasonInfo(
        String code,
        String name,
        String description
    ) {

        public static AiPlanReasonInfo from(AiPlanDraft.AiPlanDraftReason reason) {
            return AiPlanReasonInfo.builder()
                .code(reason.code())
                .name(reason.name())
                .description(reason.description())
                .build();
        }
    }
}

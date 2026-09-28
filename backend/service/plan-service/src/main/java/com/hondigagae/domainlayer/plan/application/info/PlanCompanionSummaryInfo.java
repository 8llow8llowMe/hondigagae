package com.hondigagae.domainlayer.plan.application.info;

import lombok.Builder;

/**
 * 반려견 삭제 확인창에 싣는 "이 아이가 동행한 일정" 집계 (#972).
 *
 * @param editablePlanCount       아직 바꿀 수 있는(DRAFT·CONFIRMED) 일정 중 이 아이가 동행한 일정 수 — 삭제하면 동행 목록에서 빠진다
 * @param soleCompanionPlanCount  그중 이 아이가 <b>유일한</b> 동행인 일정 수 — 일정은 남고 이 아이가 자리 표시자로 남는다 (R3)
 * @param completedPlanCount      완료된 일정 중 이 아이가 동행한 일정 수 — 다녀온 기록이라 그대로 남는다
 */
@Builder
public record PlanCompanionSummaryInfo(
    long petId,
    int editablePlanCount,
    int soleCompanionPlanCount,
    int completedPlanCount
) {
}

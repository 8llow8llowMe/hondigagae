package com.hondigagae.domainlayer.plan.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "반려견 삭제 확인창용 동행 일정 집계 응답 DTO. 삭제 전에 어느 일정이 어떻게 바뀌는지 알려 준다")
public record PlanCompanionSummaryResponse(

    @Schema(description = "집계한 반려견 아이디", example = "1234567890123456789")
    String petId,

    @Schema(
        description = "아직 바꿀 수 있는(초안·확정) 일정 중 이 반려견이 동행한 일정 수. "
            + "삭제하면 이 일정들의 동행 목록에서 빠진다 (soleCompanionPlanCount 에 든 일정은 예외)",
        example = "3")
    int editablePlanCount,

    @Schema(
        description = "editablePlanCount 중 이 반려견이 유일한 동행인 일정 수. 일정은 지워지지 않고 남으며, "
            + "동행 목록에는 삭제된 반려견 아이디가 자리 표시자로 남는다 — 화면은 petIds 와 내 반려견 목록의 교집합이 비면 "
            + "'동행 반려견 없음' 으로 보여 준다",
        example = "1")
    int soleCompanionPlanCount,

    @Schema(description = "완료된 일정 중 이 반려견이 동행한 일정 수. 다녀온 기록이라 삭제해도 바뀌지 않는다", example = "2")
    int completedPlanCount
) {
}

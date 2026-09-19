package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "브리핑 일정 요약 DTO")
public record PlanBriefingScheduleItem(

    @Schema(description = "그날 일정 항목 수", example = "4")
    int itemCount,

    @Schema(description = "그날 방문 체크된 항목 수", example = "1")
    int visitedCount,

    @Schema(description = "순서상 첫 항목. 항목이 없으면 null", nullable = true)
    PlanBriefingItemSummaryItem firstItem,

    @Schema(description = "순서상 마지막 항목. 항목이 없으면 null. 항목이 하나면 firstItem 과 같다", nullable = true)
    PlanBriefingItemSummaryItem lastItem,

    @Schema(description = "그날 기준이 된 장소 아이디 — 가장 이른 순서의 장소성 항목. "
        + "날씨·골든타임이 이 장소를 기준으로 판정된다. 장소성 항목이 없으면 null",
        example = "212481712381923328", nullable = true)
    String representativePlaceId,

    @Schema(description = "그날 기준이 된 장소명", example = "협재해수욕장", nullable = true)
    String representativePlaceTitle,

    @Schema(description = "그날 기준이 된 장소의 위도. **walkTimes 가 null 인 날에도 이 좌표는 나온다** — "
        + "골든타임을 못 붙였어도 화면이 지도와 시간대별 곡선(GET /api/v1/insights/walk-times?lat=&lng=)을 부를 수 있어야 하기 때문이다. "
        + "원천이 좌표를 주지 않거나 delisted 된 장소면 null 이고, 그때는 walkTimesUnavailableReasonCode 가 NO_PLACE_POINT 다",
        example = "33.394162", nullable = true)
    Double representativeLat,

    @Schema(description = "그날 기준이 된 장소의 경도. representativeLat 과 같은 규칙으로 채워지고 같은 규칙으로 null 이 된다",
        example = "126.239831", nullable = true)
    Double representativeLng
) {
}

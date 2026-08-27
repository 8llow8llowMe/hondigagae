package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "일자별 날씨 브리핑 DTO")
public record PlanDayWeatherItem(

    @Schema(description = "일차 (1부터)", example = "2")
    int day,

    @Schema(description = "해당 일자", example = "2026-09-13")
    LocalDate date,

    @Schema(description = "그날 기준이 된 장소 아이디", example = "212481712381923328", nullable = true)
    String representativePlaceId,

    @Schema(description = "그날 기준이 된 장소명", example = "협재해수욕장", nullable = true)
    String representativePlaceTitle,

    @Schema(description = "적합도 점수(0~100). 판단 근거가 없으면 null", example = "62", nullable = true)
    Integer score,

    @Schema(description = "적합도 등급 metadata", nullable = true)
    ScoreMetricMetadata suitabilityLevel,

    @Schema(description = "판정 근거")
    List<PlanWeatherReasonItem> reasons,

    @Schema(description = "그날의 날씨 요약", nullable = true)
    PlanDailyWeatherItem weather,

    @Schema(description = "비 예보일 때 제안하는 실내 대안 장소")
    List<PlanAlternativePlaceItem> indoorAlternatives,

    @Schema(
        description = "브리핑을 내지 못한 이유. null 이면 정상이며, 값이 있으면 화면에 그대로 안내한다",
        example = "이 날짜에는 장소가 지정된 일정 항목이 없어 날씨를 붙이지 못했습니다.",
        nullable = true)
    String unavailableReason
) {
}

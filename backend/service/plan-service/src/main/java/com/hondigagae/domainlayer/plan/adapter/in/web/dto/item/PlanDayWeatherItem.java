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

    @Schema(description = "그날 판정의 기준이 된 반려견 아이디 — 아이별 판정 중 점수가 가장 낮은 아이. "
        + "score·suitabilityLevel·reasons·indoorAlternatives 는 이 아이 기준이다. 판정을 못 냈으면 null",
        example = "1234567890123456789", nullable = true)
    String basisPetId,

    @Schema(description = "적합도 점수(0~100). 기준 반려견(basisPetId) 기준. 판단 근거가 없으면 null", example = "62", nullable = true)
    Integer score,

    @Schema(description = "적합도 등급 metadata. 기준 반려견(basisPetId) 기준. 판단 근거가 없으면 null", nullable = true)
    ScoreMetricMetadata suitabilityLevel,

    @Schema(description = "판정 근거 목록. 기준 반려견 기준이며 판정을 못 낸 날은 빈 배열")
    List<PlanWeatherReasonItem> reasons,

    @Schema(description = "그날의 날씨 요약. 예보가 닿지 않는 날은 null", nullable = true)
    PlanDailyWeatherItem weather,

    @Schema(description = "비 예보일 때 제안하는 실내 대안 장소 목록. 해당 없으면 빈 배열")
    List<PlanAlternativePlaceItem> indoorAlternatives,

    @Schema(description = "아이별 점수·등급. 한 마리 일정이면 원소 하나고, 판정을 못 낸 날은 빈 배열이다")
    List<PlanDayPetSuitabilityItem> petSuitabilities,

    @Schema(
        description = "브리핑을 내지 못한 이유. null 이면 정상이며, 값이 있으면 화면에 그대로 안내한다",
        example = "이 날짜에는 장소가 지정된 일정 항목이 없어 날씨를 붙이지 못했습니다.",
        nullable = true)
    String unavailableReason
) {
}

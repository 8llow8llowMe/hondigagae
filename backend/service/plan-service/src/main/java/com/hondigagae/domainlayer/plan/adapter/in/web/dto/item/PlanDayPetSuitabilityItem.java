package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

/**
 * 한 마리의 그날 적합도 요약. 판정 근거(reasons)·날씨·실내 대안은 기준 반려견 것만 일자에 한 번 붙는다 —
 * 날씨는 아이마다 같고, 근거 목록을 마리 수만큼 반복하면 응답이 읽기 어려워진다.
 */
@Builder
@Schema(description = "일자별 반려견 적합도 요약 DTO")
public record PlanDayPetSuitabilityItem(

    @Schema(description = "반려견 아이디", example = "1234567890123456789")
    String petId,

    @Schema(description = "이 반려견 기준 적합도 점수(0~100). 판단 근거가 없으면 null", example = "48", nullable = true)
    Integer score,

    @Schema(description = "이 반려견 기준 적합도 등급 metadata", nullable = true)
    ScoreMetricMetadata suitabilityLevel
) {
}

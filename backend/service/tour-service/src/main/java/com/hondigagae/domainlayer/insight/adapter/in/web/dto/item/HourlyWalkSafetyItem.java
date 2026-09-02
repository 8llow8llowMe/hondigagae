package com.hondigagae.domainlayer.insight.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 한 시각의 산책 안전 등급.
 *
 * <p>등급만 주면 화면이 색깔 막대는 그려도 <b>왜 그 색인지</b>는 말하지 못한다. 기온과
 * 추정 노면온도를 함께 담아 사용자가 판단을 검증할 수 있게 한다 (api-design-guide §9).
 */
@Builder
@Schema(description = "시간대별 산책 안전 DTO")
public record HourlyWalkSafetyItem(

    @Schema(description = "예보 시각", example = "2026-09-02T15:00:00")
    LocalDateTime at,

    @Schema(description = "산책 안전 등급 metadata")
    ScoreMetricMetadata walkSafetyLevel,

    @Schema(description = "기온(℃)", example = "29.0")
    double temperature,

    @Schema(
        description = "추정 노면온도(℃). 기온에 일사와 시간대를 더해 계산한 값이며 실측이 아니다",
        example = "44.0")
    double estimatedPavementCelsius,

    @Schema(description = "강수확률(%). 원천에 없는 시각은 null", example = "20", nullable = true)
    Integer precipitationProbability
) {
}

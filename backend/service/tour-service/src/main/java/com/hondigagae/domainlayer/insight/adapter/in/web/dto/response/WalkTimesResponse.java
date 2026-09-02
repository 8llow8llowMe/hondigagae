package com.hondigagae.domainlayer.insight.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.HourlyWalkSafetyItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.WeatherWarningItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;

/**
 * 오늘의 산책 골든타임 응답.
 *
 * <p><b>{@code goldenStart} 가 null 일 수 있다.</b> 남은 시간이 전부 위험 등급이거나 특보
 * 경보가 발효 중인 날이다. 그때 아무 구간이나 골라 주면 사용자는 그것을 허락으로 읽는다 -
 * 오늘은 나가지 말라고 말하는 편이 맞다.
 */
@Builder
@Schema(description = "오늘의 산책 골든타임 응답 DTO")
public record WalkTimesResponse(

    @Schema(description = "기준 시각. 이 시각 이후만 본다", example = "2026-09-02T13:20:00")
    LocalDateTime from,

    @Schema(description = "시간대별 안전 등급 곡선. 오늘 남은 예보 시각만 담긴다")
    List<HourlyWalkSafetyItem> hourly,

    @Schema(description = "골든타임 시작. 추천할 구간이 없으면 null", example = "2026-09-02T18:00:00", nullable = true)
    LocalDateTime goldenStart,

    @Schema(description = "골든타임 종료. 추천할 구간이 없으면 null", example = "2026-09-02T21:00:00", nullable = true)
    LocalDateTime goldenEnd,

    @Schema(description = "골든타임의 안전 등급 metadata. 추천할 구간이 없으면 null", nullable = true)
    ScoreMetricMetadata goldenLevel,

    @Schema(
        description = "발효 중인 기상특보. 경보면 골든타임을 주지 않는다",
        nullable = true)
    WeatherWarningItem weatherWarning,

    @Schema(description = "요청에 반려견 조건이 포함되어 판정에 반영됐는지", example = "true")
    boolean petConditionApplied
) {
}

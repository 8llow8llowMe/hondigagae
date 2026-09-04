package com.hondigagae.domainlayer.insight.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
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
 *
 * <p><b>{@code hourly} 가 빈 배열일 수 있고, 그것은 오류가 아니다.</b> 늦은 밤에는 오늘 남은
 * 예보가 없다 - 기상청은 23시 발표부터 다음 날 예보만 준다. 그때 5xx 를 내면 화면이 이유 없이
 * 사라지므로 200 으로 답하고 {@code forecastCoverage} 에 이유를 담는다.
 */
@Builder
@Schema(description = "오늘의 산책 골든타임 응답 DTO")
public record WalkTimesResponse(

    @Schema(description = "기준 시각. 이 시각 이후만 본다", example = "2026-09-02T13:20:00")
    LocalDateTime from,

    @Schema(description = "시간대별 안전 등급 곡선. 오늘 남은 예보 시각만 담긴다. 비어 있을 수 있다")
    List<HourlyWalkSafetyItem> hourly,

    @Schema(
        description = "곡선이 빈 이유 metadata. `AVAILABLE`(곡선 있음) / "
            + "`DAY_ENDED`(오늘 예보 시간대가 지남 — 정상, 자정 이후 다시 채워진다) / "
            + "`UNAVAILABLE`(날씨를 가져오지 못함 — 재시도할 일이다). "
            + "**빈 곡선을 그냥 숨기지 말고 이 값으로 문구를 갈라 주세요**")
    CodeNameDescriptionMetadata forecastCoverage,

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

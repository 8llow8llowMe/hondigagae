package com.hondigagae.domainlayer.insight.application.info;

import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.model.GoldenWalkWindow;
import com.hondigagae.domainlayer.insight.domain.model.HourlyWalkSafety;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;

/**
 * 오늘 남은 시간의 산책 안전 곡선과 골든타임.
 *
 * <p>{@code goldenWindow} 가 null 일 수 있다 - 남은 시간이 전부 위험 등급인 날이다.
 * 그때 아무 구간이나 골라 주면 사용자는 그것을 허락으로 읽는다.
 *
 * <p>{@code curve} 도 비어 있을 수 있다. <b>빈 곡선은 실패가 아니다</b> - 밤에는 오늘 남은
 * 예보가 없는 것이 정상이다. {@code forecastCoverage} 가 그 둘(정상/장애)을 가른다.
 */
@Builder
public record WalkTimesInfo(
    double lat,
    double lng,
    LocalDateTime from,
    List<HourlyWalkSafety> curve,
    // 곡선이 비었을 때 그 이유. 곡선이 있으면 AVAILABLE 이다
    ForecastCoverage forecastCoverage,
    GoldenWalkWindow goldenWindow,
    WeatherWarning weatherWarning,
    boolean petConditionApplied
) {

}

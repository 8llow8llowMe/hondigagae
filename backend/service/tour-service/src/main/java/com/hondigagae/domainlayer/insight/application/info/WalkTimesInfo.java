package com.hondigagae.domainlayer.insight.application.info;

import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.enums.GoldenWindowStatus;
import com.hondigagae.domainlayer.insight.domain.model.GoldenWalkWindow;
import com.hondigagae.domainlayer.insight.domain.model.HourlyWalkSafety;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;

/**
 * 오늘 남은 시간의 산책 안전 곡선과 골든타임.
 *
 * <p>{@code goldenWindow} 가 null 일 수 있다. 아무 구간이나 골라 주면 사용자는 그것을 허락으로
 * 읽기 때문이다. <b>없는 이유는 {@code goldenWindowStatus} 가 따로 말한다</b> - null 하나로는
 * 화면이 "위험해서"인지 "경보라서"인지 "예보가 없어서"인지 고를 수 없다.
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
    // 추천 구간이 없을 때 그 이유. 구간이 있으면 AVAILABLE 이다
    GoldenWindowStatus goldenWindowStatus,
    WeatherWarning weatherWarning,
    boolean petConditionApplied
) {

}

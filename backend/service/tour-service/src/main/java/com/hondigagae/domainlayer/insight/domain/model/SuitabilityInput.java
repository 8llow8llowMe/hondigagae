package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import lombok.Builder;

/**
 * 적합도 판정 입력 묶음.
 *
 * <p>{@code weather} 가 null 이면 판정을 하지 않는다. 왜 없는지를 {@code coverage} 로
 * 구분하는 이유는 사용자에게 하는 말이 달라지기 때문이다 - "예보가 닿지 않는 날짜"는 기다릴
 * 일이고, "예보 시간대가 지났다"는 밤마다 일어나는 정상 상태이며, "가져오지 못함"만 장애다.
 */
@Builder
public record SuitabilityInput(
    PlaceCondition place,
    PetCondition pet,
    // null 이면 판정 불가
    DailyWeather weather,
    // 날씨를 못 쓸 때 그 이유. null 이면 UNAVAILABLE 로 본다
    ForecastCoverage coverage,
    // null 또는 UNKNOWN 이면 혼잡도를 근거에서 뺀다
    CongestionSnapshot congestion,
    // 발효 중인 가장 무거운 특보. null 이면 특보가 없거나 조회하지 못한 것이다.
    WeatherWarning weatherWarning,
    SuitabilityThresholds thresholds
) {

}

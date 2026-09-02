package com.hondigagae.domainlayer.insight.domain.model;

import lombok.Builder;

/**
 * 적합도 판정 입력 묶음.
 *
 * <p>{@code weather} 가 null 이면 판정을 하지 않는다. 왜 없는지를 {@code forecastOutOfRange}
 * 로 구분하는 이유는 사용자에게 하는 말이 달라지기 때문이다 - "예보가 닿지 않는 날짜"는
 * 정상이고 기다릴 일이지만, "가져오지 못함"은 장애라 다시 시도할 일이다.
 */
@Builder
public record SuitabilityInput(
    PlaceCondition place,
    PetCondition pet,
    // null 이면 판정 불가
    DailyWeather weather,
    boolean forecastOutOfRange,
    // null 또는 UNKNOWN 이면 혼잡도를 근거에서 뺀다
    CongestionSnapshot congestion,
    // 발효 중인 가장 무거운 특보. null 이면 특보가 없거나 조회하지 못한 것이다.
    WeatherWarning weatherWarning,
    SuitabilityThresholds thresholds
) {

}

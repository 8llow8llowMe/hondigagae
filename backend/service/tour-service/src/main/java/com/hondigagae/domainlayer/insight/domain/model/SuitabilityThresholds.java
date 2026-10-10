package com.hondigagae.domainlayer.insight.domain.model;

import lombok.Builder;

/**
 * 판정에 쓰는 임계값 묶음.
 *
 * <p>도메인이 Spring 프로퍼티 타입을 직접 알지 않게 하려고 한 겹 둔다. 값의 출처는
 * {@code InsightProperties} 지만, 그것을 아는 것은 application 계층까지다.
 */
@Builder
public record SuitabilityThresholds(
    int rainProbabilityPercent,
    double hotTemperature,
    double veryHotTemperature,
    double coldTemperature,
    double veryColdTemperature,
    double strongWindSpeed,
    double pavementCautionCelsius,
    double pavementDangerCelsius,
    // 기상청 여름철 체감온도 기준 — 폭염특보 척도(주의보 33℃·경보 35℃)와 같은 값 체계다.
    double feelsLikeCautionCelsius,
    double feelsLikeDangerCelsius
) {

}

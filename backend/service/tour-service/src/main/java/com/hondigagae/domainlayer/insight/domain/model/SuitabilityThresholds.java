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
    double heatIndexCautionCelsius,
    double heatIndexDangerCelsius
) {

}

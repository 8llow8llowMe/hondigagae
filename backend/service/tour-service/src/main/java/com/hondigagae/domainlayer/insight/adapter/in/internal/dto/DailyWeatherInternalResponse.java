package com.hondigagae.domainlayer.insight.adapter.in.internal.dto;

import java.time.LocalDate;
import lombok.Builder;

/**
 * 다른 서비스(ai-service)가 프롬프트에 싣는 하루치 예보 요약.
 *
 * <p>웹 응답과 다른 DTO 를 쓰는 이유는 소비 방식이 다르기 때문이다. 프롬프트는 사람이 읽는
 * 문장이라 enum metadata 대신 <b>표시명</b>을 바로 준다 (장소 후보 내부 API 와 같은 방침).
 * 값이 없는 필드는 null 유지 — 지어내지 않고, 소비 측이 그 줄을 생략한다.
 */
@Builder
public record DailyWeatherInternalResponse(
    LocalDate date,
    // 단기/중기 구분 표시명. 신뢰도가 다르다는 사실을 소비 측이 알 수 있게 한다.
    String forecastSourceName,
    String skyStateName,
    String precipitationTypeName,
    Integer maxPrecipitationProbability,
    Double minTemperature,
    Double maxTemperature,
    Double maxWindSpeed
) {

}

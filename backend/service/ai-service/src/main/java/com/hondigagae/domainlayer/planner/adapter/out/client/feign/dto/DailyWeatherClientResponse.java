package com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDate;

/**
 * tour-service 일자별 예보 응답의 Feign 전용 표현 (coding-conventions §12-1).
 * 표시명이 이미 변환되어 오므로 enum 매핑 없이 그대로 모델로 옮긴다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DailyWeatherClientResponse(
    LocalDate date,
    String forecastSourceName,
    String skyStateName,
    String precipitationTypeName,
    Integer maxPrecipitationProbability,
    Double minTemperature,
    Double maxTemperature,
    Double maxWindSpeed
) {

}

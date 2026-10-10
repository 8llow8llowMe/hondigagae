package com.hondigagae.domainlayer.planner.application.model;

import java.time.LocalDate;
import lombok.Builder;

/**
 * 여행 기간 하루치 날씨 전망. 프롬프트에 그대로 실리므로 값은 사람이 읽는 표시명이다.
 *
 * <p>이 값이 있어야 "비 오는 날은 실내 위주" 같은 배치가 <b>그날 실제로 비가 오는지</b>를
 * 근거로 이뤄진다 — 없으면 반려견의 더위 민감도만 알고 그날 더운지는 모르는 채 일정을 짠다.
 * 조회 실패·예보 범위 밖 날짜는 전망 없이 진행한다 (반려견 특성과 같은 관용 원칙).
 */
@Builder
public record DayWeatherOutlook(
    LocalDate date,
    // 단기/중기 표시명. 신뢰도 차이를 프롬프트에도 드러낸다.
    String forecastSourceName,
    String skyStateName,
    String precipitationTypeName,
    Integer maxPrecipitationProbability,
    Double minTemperature,
    Double maxTemperature,
    Double maxWindSpeed
) {

}

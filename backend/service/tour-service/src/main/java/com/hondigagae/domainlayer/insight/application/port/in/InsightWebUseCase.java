package com.hondigagae.domainlayer.insight.application.port.in;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.RegionalWeatherResponse;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import java.time.LocalDate;

/**
 * 장소에 매이지 않은 인사이트 유스케이스.
 *
 * <p>{@code PlaceInsightWebUseCase} 와 나눈 기준은 <b>입력</b>이다. 그쪽은 장소 아이디로
 * 시작하지만 이쪽은 권역이나 좌표로 시작한다. 한 유스케이스에 섞으면 "placeId 가 없어도 되는
 * 메서드"가 생겨 계약이 흐려진다.
 */
public interface InsightWebUseCase {

    /**
     * 제주 권역 날씨 비교.
     *
     * @param date 대상 날짜. null 이면 오늘
     * @param pet  반려견 조건. 더위/추위 민감이 점수에 반영된다
     */
    RegionalWeatherResponse getRegionalWeather(LocalDate date, PetCondition pet);
}

package com.hondigagae.domainlayer.planner.application.port.out;

import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import java.util.List;

/**
 * 여행 지역의 일자별 날씨 전망 조회 계약.
 *
 * <p>비어 있으면 전망 없이 진행한다 — tour-service 장애나 예보 커버리지 밖 날짜가
 * 일정 생성 자체를 막으면 안 된다. 대신 프롬프트에서 날씨 절이 빠진다.
 */
public interface WeatherOutlookQueryPort {

    List<DayWeatherOutlook> findDailyOutlook(String areaCode);
}

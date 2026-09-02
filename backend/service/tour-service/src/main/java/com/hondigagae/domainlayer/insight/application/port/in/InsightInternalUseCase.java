package com.hondigagae.domainlayer.insight.application.port.in;

import com.hondigagae.domainlayer.insight.adapter.in.internal.dto.DailyWeatherInternalResponse;
import java.util.List;

/**
 * 서비스 간 호출 전용 유스케이스 (coding-conventions §5).
 *
 * <p>예보 판정의 원천은 이 서비스다. ai-service 가 일정 생성 프롬프트에 여행 기간의
 * 날씨 전망을 실을 때 가져간다 — 사본을 두면 캐시·회차 갱신 규칙이 두 곳으로 갈라진다.
 */
public interface InsightInternalUseCase {

    /**
     * 지역 대표 지점의 일자별 예보 (단기+중기 결합, 약 11일).
     * 현재는 제주(areaCode 39) 전용이다 — 다른 지역 코드는 빈 목록으로 응답한다.
     */
    List<DailyWeatherInternalResponse> getDailyWeather(String areaCode);
}

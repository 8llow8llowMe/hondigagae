package com.hondigagae.domainlayer.insight.application.port.in;

import com.hondigagae.domainlayer.insight.adapter.in.internal.dto.DailyWeatherInternalResponse;
import com.hondigagae.domainlayer.insight.adapter.in.internal.dto.WeatherWarningInternalResponse;
import java.util.List;
import java.util.Optional;

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

    /**
     * 제주에 발효 중인 특보 중 <b>가장 무거운 한 건</b>. 없으면 {@code Optional.empty()} 다.
     * 고르는 규칙은 웹 응답(적합도·산책 위험도·골든타임·권역 추천)과 같다 —
     * {@code WeatherWarning.heaviest} 한 곳이 판정을 갖는다.
     *
     * <p><b>한계: 조회 실패도 "특보 없음" 으로 온다.</b> {@code WeatherWarningProcessor} 의 규칙대로
     * 특보 조회 실패는 예외가 아니라 빈 목록이 되기 때문이다 — 아직 활용신청 전인 API 하나가
     * 이미 동작하는 판정 둘(적합도·산책 위험도)을 끌어내리지 않게 한 결정이다. 원천 실패와
     * "정말 특보가 없음" 의 구분은 이 경계에서 얻을 수 없고, 어댑터의 WARN 로그에만 남는다.
     */
    Optional<WeatherWarningInternalResponse> getActiveWeatherWarning();
}

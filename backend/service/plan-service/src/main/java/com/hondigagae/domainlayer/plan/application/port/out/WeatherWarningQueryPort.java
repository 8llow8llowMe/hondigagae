package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.application.port.out.query.WeatherWarningQueryResult;
import java.util.Optional;

/** 발효 중인 기상특보 조회 계약. tour-service 가 고른 "가장 무거운 한 건" 을 그대로 받는다. */
public interface WeatherWarningQueryPort {

    /**
     * 발효 중인 특보. 없으면 {@code Optional.empty()} 다.
     *
     * <p><b>조회 실패는 empty 가 아니라 {@code PlanException} 으로 올린다.</b> 이 포트만 예외를
     * 던지는 이유가 있다 — 날씨·골든타임은 못 받으면 그 칸이 비는 것으로 끝나지만, 특보는
     * <b>"확인 못 함" 과 "특보 없음" 이 사용자에게 전혀 다른 말</b>이기 때문이다. 실패를 empty
     * 로 접으면 태풍경보가 떠 있는 날에도 화면이 조용하고, 사용자는 그 침묵을 안전하다는
     * 뜻으로 읽는다. 호출부가 둘을 갈라 안내 문구를 다르게 낼 수 있게 구분을 남긴다.
     */
    Optional<WeatherWarningQueryResult> findActiveWarning();
}

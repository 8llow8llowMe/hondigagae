package com.hondigagae.domainlayer.auth.application.port.out;

/**
 * 카카오 인가 페이지 URL 생성 계약.
 */
public interface KakaoAuthorizationUrlPort {

    /**
     * @param state CSRF 방어용 일회성 토큰. 인가 URL에 반드시 포함되어 콜백에서 검증된다.
     */
    String generateUrl(String state);
}

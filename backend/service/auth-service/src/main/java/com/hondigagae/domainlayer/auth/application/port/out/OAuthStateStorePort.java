package com.hondigagae.domainlayer.auth.application.port.out;

import java.time.Duration;

/**
 * OAuth 인가 요청의 state(CSRF 방어 일회성 토큰) 저장 계약.
 * 카카오 단일 provider라 state 존재 여부만 검증한다.
 */
public interface OAuthStateStorePort {

    void save(String state, Duration ttl);

    /**
     * state를 원자적으로 조회+삭제한다(일회성 보장).
     *
     * @return 우리가 발급한 state였으면 true. 없거나 만료되었으면 false
     */
    boolean consume(String state);
}

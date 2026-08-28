package com.hondigagae.domainlayer.auth.application.port.out;

import java.time.Duration;
import java.util.Optional;

public interface JwtTokenStorePort {

    /**
     * 기기(세션)별로 refresh 토큰을 저장한다. sessionId 는 refresh 토큰의 jti 로,
     * 토큰이 회전해도 같은 기기는 같은 sessionId 를 유지한다.
     * 회원당 세션 수가 상한을 넘으면 가장 오래 갱신되지 않은 세션부터 밀어낸다.
     */
    void save(long memberId, String sessionId, String refreshToken);

    Optional<String> find(long memberId, String sessionId);

    /** 특정 기기 세션만 무효화한다 (로그아웃). */
    void deleteSession(long memberId, String sessionId);

    /** 회원의 전 기기 세션을 무효화한다 (탈퇴/비밀번호 변경/상태 이상). */
    void deleteAllSessions(long memberId);

    void saveAccessTokenIdBlacklist(String tokenId, Duration ttl);
}

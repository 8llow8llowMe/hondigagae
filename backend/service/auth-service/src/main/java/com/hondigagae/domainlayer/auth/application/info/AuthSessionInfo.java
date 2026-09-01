package com.hondigagae.domainlayer.auth.application.info;

import java.time.Instant;
import lombok.Builder;

/**
 * 로그인 기기(세션) 한 건. current 는 요청 쿠키의 refresh 토큰과 같은 세션인지다 —
 * access 토큰에는 세션 식별자가 없어 쿠키로만 판별할 수 있고, 쿠키가 없으면 전부 false 다.
 */
@Builder
public record AuthSessionInfo(
    String sessionId,
    Instant lastRefreshedAt,
    boolean current
) {

}

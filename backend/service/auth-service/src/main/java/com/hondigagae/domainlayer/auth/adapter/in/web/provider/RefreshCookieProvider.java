package com.hondigagae.domainlayer.auth.adapter.in.web.provider;

import com.hondigagae.security.auth.jwt.JwtAuthProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RefreshCookieProvider {

    private static final String REFRESH_TOKEN_COOKIE = "refreshToken";
    // reissue 와 logout 이 함께 쿠키를 읽는다 — 로그아웃이 "현재 기기 세션"을 특정하려면
    // 쿠키의 refresh 토큰(jti=sessionId)이 필요하므로 auth 경로 전체로 스코프를 넓혔다.
    // httpOnly + SameSite=Strict 는 유지되어 스크립트/타 사이트 접근은 여전히 불가하다.
    private static final String AUTH_PATH = "/api/v1/auth";

    private final JwtAuthProperties jwtAuthProperties;
    private final Environment environment;

    public ResponseCookie createRefreshCookie(String refreshToken) {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE, refreshToken)
            .httpOnly(true)
            .secure(isSecure())
            .sameSite("Strict")
            .path(AUTH_PATH)
            .maxAge(jwtAuthProperties.refreshExpiration().getSeconds())
            .build();
    }

    public ResponseCookie clearRefreshCookie() {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE, "")
            .httpOnly(true)
            .secure(isSecure())
            .sameSite("Strict")
            .path(AUTH_PATH)
            .maxAge(0)
            .build();
    }

    private boolean isSecure() {
        return environment.acceptsProfiles(Profiles.of("prod"));
    }
}

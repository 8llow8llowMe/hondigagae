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
    private static final String REISSUE_PATH = "/api/v1/auth/token/reissue";

    private final JwtAuthProperties jwtAuthProperties;
    private final Environment environment;

    public ResponseCookie createRefreshCookie(String refreshToken) {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE, refreshToken)
            .httpOnly(true)
            .secure(isSecure())
            .sameSite("Strict")
            .path(REISSUE_PATH)
            .maxAge(jwtAuthProperties.refreshExpiration().getSeconds())
            .build();
    }

    public ResponseCookie clearRefreshCookie() {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE, "")
            .httpOnly(true)
            .secure(isSecure())
            .sameSite("Strict")
            .path(REISSUE_PATH)
            .maxAge(0)
            .build();
    }

    private boolean isSecure() {
        return environment.acceptsProfiles(Profiles.of("prod"));
    }
}

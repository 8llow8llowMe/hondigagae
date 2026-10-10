package com.hondigagae.domainlayer.auth.application.info;

import lombok.Builder;

@Builder
public record AuthCookieResult<T>(
    T response,
    String refreshToken
) {

    public static <T> AuthCookieResult<T> of(T response, String refreshToken) {
        return AuthCookieResult.<T>builder()
            .response(response)
            .refreshToken(refreshToken)
            .build();
    }
}

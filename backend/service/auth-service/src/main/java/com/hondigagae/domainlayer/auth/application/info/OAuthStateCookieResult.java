package com.hondigagae.domainlayer.auth.application.info;

import lombok.Builder;

/**
 * 응답 + 브라우저에 심을 state. {@link AuthCookieResult} 와 같은 역할이지만 나르는 쿠키 값이
 * refresh 토큰이 아니라 state 라서 타입을 따로 뒀다 — 한 record 에 담고 필드명을 뭉뚱그리면
 * "이 문자열이 무엇인지"를 호출부가 추측하게 된다.
 *
 * <p>{@code AuthCookieResult} 와 같은 이유로 제네릭이다. 응답 타입을 박아 두면 application 이
 * web dto 를 직접 import 하게 되고, 그 예외는 {@code port/in} 시그니처 한 곳에만 허용돼 있다.
 */
@Builder
public record OAuthStateCookieResult<T>(
    T response,
    String state
) {

    public static <T> OAuthStateCookieResult<T> of(T response, String state) {
        return OAuthStateCookieResult.<T>builder()
            .response(response)
            .state(state)
            .build();
    }
}

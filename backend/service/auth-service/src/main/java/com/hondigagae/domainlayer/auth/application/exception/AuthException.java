package com.hondigagae.domainlayer.auth.application.exception;

import java.util.OptionalLong;
import lombok.AccessLevel;
import lombok.Getter;

@Getter
public class AuthException extends RuntimeException {

    private final AuthErrorCode errorCode;

    /**
     * 429 응답에 실을 {@code Retry-After}(초). 대부분의 예외에는 없다 — 있을 때만 핸들러가 헤더를 단다 (#1293).
     */
    @Getter(AccessLevel.NONE)
    private final Long retryAfterSeconds;

    public AuthException(AuthErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
        this.retryAfterSeconds = null;
    }

    public AuthException(AuthErrorCode errorCode, Object... args) {
        super(String.format(errorCode.getMessage(), args));
        this.errorCode = errorCode;
        this.retryAfterSeconds = null;
    }

    private AuthException(AuthErrorCode errorCode, Long retryAfterSeconds) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    /**
     * 재시도 가능 시각을 함께 싣는 예외. 생성자 대신 팩터리로 둔 것은 {@code (errorCode, Object... args)}
     * 와 인자 모양이 겹쳐, 숫자 하나를 넘기면 어느 생성자가 불리는지 읽는 사람이 헷갈리기 때문이다.
     */
    public static AuthException withRetryAfter(AuthErrorCode errorCode, long retryAfterSeconds) {
        return new AuthException(errorCode, Long.valueOf(retryAfterSeconds));
    }

    public OptionalLong getRetryAfterSeconds() {
        return retryAfterSeconds == null ? OptionalLong.empty() : OptionalLong.of(retryAfterSeconds);
    }
}

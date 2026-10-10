package com.hondigagae.domainlayer.auth.application.exception;

import java.time.Duration;
import java.util.Optional;
import lombok.Getter;

@Getter
public class AuthException extends RuntimeException {

    private final AuthErrorCode errorCode;
    /**
     * 다시 시도해도 되는 시점까지 남은 시간. 429 셋(쿨다운 · 로그인 잠금 · IP 발송 상한)에서만 채워지고
     * {@code AuthExceptionHandler} 가 표준 {@code Retry-After} 헤더로 내보낸다 (#1293). 나머지는 null.
     */
    private final Duration retryAfter;

    public AuthException(AuthErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
        this.retryAfter = null;
    }

    public AuthException(AuthErrorCode errorCode, Object... args) {
        super(String.format(errorCode.getMessage(), args));
        this.errorCode = errorCode;
        this.retryAfter = null;
    }

    private AuthException(AuthErrorCode errorCode, Duration retryAfter) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
        this.retryAfter = retryAfter;
    }

    /**
     * 재시도 대기 시간을 실은 예외. 생성자 대신 팩토리로 둔 것은 {@code (errorCode, Object... args)} 와
     * 시그니처가 겹쳐 {@code Duration} 이 메시지 인자로 오인되는 일을 막기 위해서다.
     */
    public static AuthException withRetryAfter(AuthErrorCode errorCode, Duration retryAfter) {
        return new AuthException(errorCode, retryAfter);
    }

    public Optional<Duration> getRetryAfter() {
        return Optional.ofNullable(retryAfter);
    }
}

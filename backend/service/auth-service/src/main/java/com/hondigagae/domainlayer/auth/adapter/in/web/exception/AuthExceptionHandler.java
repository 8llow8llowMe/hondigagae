package com.hondigagae.domainlayer.auth.adapter.in.web.exception;

import com.hondigagae.common.dto.Response;
import com.hondigagae.common.exception.ValidationErrorSupport;
import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import jakarta.validation.ConstraintViolationException;
import java.time.Duration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * auth 컨텍스트 전용 advice.
 *
 * <p>같은 서비스의 MemberExceptionHandler와 처리 대상이 겹치는 검증 예외는
 * auth 요청 DTO(AUTH_1xx)가 먼저 해석되도록 이 advice를 우선순위 앞에 둔다.
 */
@Order(0)
@RestControllerAdvice(basePackages = "com.hondigagae.domainlayer.auth")
public class AuthExceptionHandler {

    /**
     * 재시도 대기 시간이 실린 예외(429 셋 — AUTH_003 · AUTH_015 · AUTH_016)는 표준 {@code Retry-After}
     * 헤더(초, 정수)를 함께 싣는다 (#1293). 본문 봉투 · 코드 · 상태는 그대로다.
     */
    @ExceptionHandler(AuthException.class)
    public ResponseEntity<Response<Void>> handleAuthException(AuthException exception) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(exception.getErrorCode().getHttpStatus());
        exception.getRetryAfter()
            .ifPresent(retryAfter -> builder.header(HttpHeaders.RETRY_AFTER, String.valueOf(toRetryAfterSeconds(retryAfter))));
        return builder.body(Response.fail(exception.getErrorCode().getCode(), exception.getMessage()));
    }

    /**
     * 초 단위로 올림하고 최소 1초를 보장한다. 버림하면 남은 0.4초가 {@code Retry-After: 0} 이 되어
     * "지금 바로 다시 보내라"로 읽히고, 그 요청은 아직 살아 있는 키에 걸려 다시 429 가 된다.
     */
    static long toRetryAfterSeconds(Duration retryAfter) {
        long seconds = (retryAfter.toMillis() + 999) / 1000;
        return Math.max(seconds, 1L);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Response<Void>> handleValidation(MethodArgumentNotValidException exception) {
        return ValidationErrorSupport.toResponse(exception, AuthErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Response<Void>> handleConstraintViolation(ConstraintViolationException exception) {
        return ValidationErrorSupport.toResponse(exception, AuthErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<Response<Void>> handleHandlerMethodValidation(HandlerMethodValidationException exception) {
        return ValidationErrorSupport.toResponse(exception, AuthErrorCode.INVALID_REQUEST.getCode());
    }

    /** 이 핸들러가 없으면 auth 경로의 타입 오류가 catch-all(MemberExceptionHandler)로 넘어가 MEMBER_113 으로 응답한다. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Response<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        return ValidationErrorSupport.toResponse(exception, AuthErrorCode.PARAMETER_TYPE_INVALID.getCode());
    }

    /** 필수 쿼리 파라미터 누락. 처리하지 않으면 Response 봉투 밖의 Spring 기본 에러 바디가 나간다. */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Response<Void>> handleMissingParameter(MissingServletRequestParameterException exception) {
        AuthErrorCode errorCode = AuthErrorCode.PARAMETER_REQUIRED;
        return ResponseEntity
            .status(errorCode.getHttpStatus())
            .body(Response.fail(errorCode.getCode(), errorCode.getMessage() + " (" + exception.getParameterName() + ")"));
    }
}

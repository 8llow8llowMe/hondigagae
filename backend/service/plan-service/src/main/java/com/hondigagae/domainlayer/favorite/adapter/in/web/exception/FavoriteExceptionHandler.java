package com.hondigagae.domainlayer.favorite.adapter.in.web.exception;

import com.hondigagae.common.dto.Response;
import com.hondigagae.common.exception.ValidationErrorSupport;
import com.hondigagae.domainlayer.favorite.application.exception.FavoriteErrorCode;
import com.hondigagae.domainlayer.favorite.application.exception.FavoriteException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * favorite 컨텍스트 전용 advice.
 *
 * <p>같은 서비스의 catch-all advice(PlanExceptionHandler)보다 앞서 favorite 요청의
 * 검증 오류(FAVORITE_1xx)가 해석되도록 우선순위를 명시한다 (auth-service pet 과 같은 구조).
 */
@Order(1)
@RestControllerAdvice(basePackages = "com.hondigagae.domainlayer.favorite")
public class FavoriteExceptionHandler {

    @ExceptionHandler(FavoriteException.class)
    public ResponseEntity<Response<Void>> handleFavoriteException(FavoriteException exception) {
        return ResponseEntity
            .status(exception.getErrorCode().getHttpStatus())
            .body(Response.fail(exception.getErrorCode().getCode(), exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Response<Void>> handleValidation(MethodArgumentNotValidException exception) {
        return ValidationErrorSupport.toResponse(exception, FavoriteErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Response<Void>> handleConstraintViolation(ConstraintViolationException exception) {
        return ValidationErrorSupport.toResponse(exception, FavoriteErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<Response<Void>> handleHandlerMethodValidation(HandlerMethodValidationException exception) {
        return ValidationErrorSupport.toResponse(exception, FavoriteErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Response<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        return ValidationErrorSupport.toResponse(exception, FavoriteErrorCode.PARAMETER_TYPE_INVALID.getCode());
    }
}

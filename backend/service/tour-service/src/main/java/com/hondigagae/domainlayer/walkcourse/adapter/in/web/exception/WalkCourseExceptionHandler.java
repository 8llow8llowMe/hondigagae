package com.hondigagae.domainlayer.walkcourse.adapter.in.web.exception;

import com.hondigagae.common.dto.Response;
import com.hondigagae.common.exception.ValidationErrorSupport;
import com.hondigagae.domainlayer.walkcourse.application.exception.WalkCourseErrorCode;
import com.hondigagae.domainlayer.walkcourse.application.exception.WalkCourseException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * walkcourse 컨텍스트 전용 advice.
 *
 * <p>place 의 catch-all advice 보다 앞서 WALKCOURSE_1xx 코드가 해석되도록 우선순위를 명시한다.
 */
@Order(0)
@RestControllerAdvice(basePackages = "com.hondigagae.domainlayer.walkcourse")
public class WalkCourseExceptionHandler {

    @ExceptionHandler(WalkCourseException.class)
    public ResponseEntity<Response<Void>> handleWalkCourseException(WalkCourseException exception) {
        return ResponseEntity
            .status(exception.getErrorCode().getHttpStatus())
            .body(Response.fail(exception.getErrorCode().getCode(), exception.getMessage()));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Response<Void>> handleConstraintViolation(ConstraintViolationException exception) {
        return ValidationErrorSupport.toResponse(exception, WalkCourseErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<Response<Void>> handleHandlerMethodValidation(HandlerMethodValidationException exception) {
        return ValidationErrorSupport.toResponse(exception, WalkCourseErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Response<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        return ValidationErrorSupport.toResponse(exception, WalkCourseErrorCode.PARAMETER_TYPE_INVALID.getCode());
    }
}

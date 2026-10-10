package com.hondigagae.domainlayer.plan.adapter.in.web.exception;

import com.hondigagae.common.dto.Response;
import com.hondigagae.common.exception.ValidationErrorSupport;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * plan-service 의 기본(catch-all) advice. favorite 컨텍스트는 전용 advice(@Order(1))가 먼저 받는다.
 */
@RestControllerAdvice(basePackages = "com.hondigagae.domainlayer")
public class PlanExceptionHandler {

    @ExceptionHandler(PlanException.class)
    public ResponseEntity<Response<Void>> handlePlanException(PlanException exception) {
        return ResponseEntity
            .status(exception.getErrorCode().getHttpStatus())
            .body(Response.fail(exception.getErrorCode().getCode(), exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Response<Void>> handleValidation(MethodArgumentNotValidException exception) {
        return ValidationErrorSupport.toResponse(exception, PlanErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Response<Void>> handleConstraintViolation(ConstraintViolationException exception) {
        return ValidationErrorSupport.toResponse(exception, PlanErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<Response<Void>> handleHandlerMethodValidation(HandlerMethodValidationException exception) {
        return ValidationErrorSupport.toResponse(exception, PlanErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Response<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        return ValidationErrorSupport.toResponse(exception, PlanErrorCode.PARAMETER_TYPE_INVALID.getCode());
    }

    /** 본문을 읽지 못한 요청(깨진 JSON, enum 에 없는 itemType 등). 처리하지 않으면 Response 봉투 밖의 Spring 기본 400 이 나간다 (#214). */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Response<Void>> handleUnreadableBody(HttpMessageNotReadableException exception) {
        return ValidationErrorSupport.toResponse(exception, PlanErrorCode.INVALID_REQUEST.getCode());
    }
    /** 필수 쿼리 파라미터 누락. 처리하지 않으면 Response 봉투 밖의 Spring 기본 에러 바디가 나간다. */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Response<Void>> handleMissingParameter(MissingServletRequestParameterException exception) {
        PlanErrorCode errorCode = PlanErrorCode.PARAMETER_REQUIRED;
        return ResponseEntity
            .status(errorCode.getHttpStatus())
            .body(Response.fail(errorCode.getCode(), errorCode.getMessage() + " (" + exception.getParameterName() + ")"));
    }
}

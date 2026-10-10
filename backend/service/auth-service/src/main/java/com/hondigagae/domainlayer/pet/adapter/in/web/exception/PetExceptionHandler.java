package com.hondigagae.domainlayer.pet.adapter.in.web.exception;

import com.hondigagae.common.dto.Response;
import com.hondigagae.common.exception.ValidationErrorSupport;
import com.hondigagae.domainlayer.pet.application.exception.PetErrorCode;
import com.hondigagae.domainlayer.pet.application.exception.PetException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * pet 컨텍스트 전용 advice.
 *
 * <p>같은 서비스의 catch-all advice(MemberExceptionHandler)보다 앞서 pet 요청 DTO(PET_1xx)가
 * 해석되도록 우선순위를 명시한다.
 */
@Order(1)
@RestControllerAdvice(basePackages = "com.hondigagae.domainlayer.pet")
public class PetExceptionHandler {

    @ExceptionHandler(PetException.class)
    public ResponseEntity<Response<Void>> handlePetException(PetException exception) {
        return ResponseEntity
            .status(exception.getErrorCode().getHttpStatus())
            .body(Response.fail(exception.getErrorCode().getCode(), exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Response<Void>> handleValidation(MethodArgumentNotValidException exception) {
        return ValidationErrorSupport.toResponse(exception, PetErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Response<Void>> handleConstraintViolation(ConstraintViolationException exception) {
        return ValidationErrorSupport.toResponse(exception, PetErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<Response<Void>> handleHandlerMethodValidation(HandlerMethodValidationException exception) {
        return ValidationErrorSupport.toResponse(exception, PetErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Response<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        return ValidationErrorSupport.toResponse(exception, PetErrorCode.PARAMETER_TYPE_INVALID.getCode());
    }
    /** 필수 쿼리 파라미터 누락. 처리하지 않으면 Response 봉투 밖의 Spring 기본 에러 바디가 나간다. */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Response<Void>> handleMissingParameter(MissingServletRequestParameterException exception) {
        PetErrorCode errorCode = PetErrorCode.PARAMETER_REQUIRED;
        return ResponseEntity
            .status(errorCode.getHttpStatus())
            .body(Response.fail(errorCode.getCode(), errorCode.getMessage() + " (" + exception.getParameterName() + ")"));
    }
}

package com.hondigagae.domainlayer.member.adapter.in.web.exception;

import com.hondigagae.common.dto.Response;
import com.hondigagae.common.exception.ValidationErrorSupport;
import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.storage.exception.StorageErrorCode;
import com.hondigagae.storage.exception.StorageException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice(basePackages = "com.hondigagae.domainlayer")
public class MemberExceptionHandler {

    private static final String EMAIL_UNIQUE_CONSTRAINT = "uk_member_email";

    @ExceptionHandler(MemberException.class)
    public ResponseEntity<Response<Void>> handleMemberException(MemberException exception) {
        return ResponseEntity
            .status(exception.getErrorCode().getHttpStatus())
            .body(Response.fail(exception.getErrorCode().getCode(), exception.getMessage()));
    }

    /**
     * 스토리지 예외를 공통 Response 형식으로 변환한다.
     * 이 핸들러가 없으면 파일 업로드 실패가 Spring 기본 500 응답으로 새어 나간다.
     */
    @ExceptionHandler(StorageException.class)
    public ResponseEntity<Response<Void>> handleStorageException(StorageException exception) {
        return ResponseEntity
            .status(exception.getErrorCode().getHttpStatus())
            .body(Response.fail(exception.getErrorCode().getCode(), exception.getMessage()));
    }

    /**
     * multipart 상한(spring.servlet.multipart)을 넘긴 요청. 스토리지 자체 크기 검증과 같은 코드로 응답해
     * 클라이언트가 한 가지 분기만 처리하면 되게 한다.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Response<Void>> handleMaxUploadSizeExceeded(MaxUploadSizeExceededException exception) {
        StorageErrorCode errorCode = StorageErrorCode.FILE_TOO_LARGE;
        return ResponseEntity.status(errorCode.getHttpStatus())
            .body(Response.fail(errorCode.getCode(), errorCode.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Response<Void>> handleValidation(MethodArgumentNotValidException exception) {
        return ValidationErrorSupport.toResponse(exception, MemberErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Response<Void>> handleConstraintViolation(ConstraintViolationException exception) {
        return ValidationErrorSupport.toResponse(exception, MemberErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<Response<Void>> handleHandlerMethodValidation(HandlerMethodValidationException exception) {
        return ValidationErrorSupport.toResponse(exception, MemberErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Response<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        return ValidationErrorSupport.toResponse(exception, MemberErrorCode.PARAMETER_TYPE_INVALID.getCode());
    }

    /**
     * 동시 가입 레이스에서 uk_member_email 제약이 두 번째 요청을 잡으면 500 대신
     * 일반 중복 응답과 동일한 409로 변환한다.
     * 그 외 제약 위반(NOT NULL 등)은 중복 가입으로 오인시키지 않고 500으로 남긴다.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Response<Void>> handleDataIntegrityViolation(DataIntegrityViolationException exception) {
        if (!isEmailUniqueViolation(exception)) {
            throw exception;
        }

        MemberErrorCode errorCode = MemberErrorCode.EXIST_MEMBER_EMAIL;
        return ResponseEntity.status(errorCode.getHttpStatus())
            .body(Response.fail(errorCode.getCode(), "이미 가입된 이메일입니다."));
    }

    private boolean isEmailUniqueViolation(DataIntegrityViolationException exception) {
        String message = exception.getMostSpecificCause().getMessage();
        return message != null && message.contains(EMAIL_UNIQUE_CONSTRAINT);
    }
    /** 필수 쿼리 파라미터 누락. 처리하지 않으면 Response 봉투 밖의 Spring 기본 에러 바디가 나간다. */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Response<Void>> handleMissingParameter(MissingServletRequestParameterException exception) {
        MemberErrorCode errorCode = MemberErrorCode.PARAMETER_REQUIRED;
        return ResponseEntity
            .status(errorCode.getHttpStatus())
            .body(Response.fail(errorCode.getCode(), errorCode.getMessage() + " (" + exception.getParameterName() + ")"));
    }
}

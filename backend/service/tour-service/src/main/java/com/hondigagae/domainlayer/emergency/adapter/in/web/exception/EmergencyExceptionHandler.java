package com.hondigagae.domainlayer.emergency.adapter.in.web.exception;

import com.hondigagae.common.dto.Response;
import com.hondigagae.common.exception.ValidationErrorSupport;
import com.hondigagae.domainlayer.emergency.application.exception.EmergencyErrorCode;
import com.hondigagae.domainlayer.emergency.application.exception.EmergencyException;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * emergency 컨텍스트 전용 advice.
 *
 * <p>place 의 catch-all advice 보다 앞서 EMERGENCY_1xx 코드가 해석되도록 우선순위를 명시한다.
 */
@Slf4j
@Order(0)
@RestControllerAdvice(basePackages = "com.hondigagae.domainlayer.emergency")
public class EmergencyExceptionHandler {

    @ExceptionHandler(EmergencyException.class)
    public ResponseEntity<Response<Void>> handleEmergencyException(EmergencyException exception) {
        return ResponseEntity
            .status(exception.getErrorCode().getHttpStatus())
            .body(Response.fail(exception.getErrorCode().getCode(), exception.getMessage()));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Response<Void>> handleConstraintViolation(ConstraintViolationException exception) {
        return ValidationErrorSupport.toResponse(exception, EmergencyErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<Response<Void>> handleHandlerMethodValidation(HandlerMethodValidationException exception) {
        return ValidationErrorSupport.toResponse(exception, EmergencyErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Response<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        return ValidationErrorSupport.toResponse(exception, EmergencyErrorCode.PARAMETER_TYPE_INVALID.getCode());
    }

    /**
     * 필수 쿼리 파라미터 누락.
     *
     * <p>핸들러가 없으면 스프링 기본 응답이 나가 <b>Response 봉투 밖 형태</b>가 된다.
     * 클라이언트는 모든 오류를 같은 봉투로 받는다고 전제하고 파싱하므로, 이 한 경우만
     * 형태가 달라지면 파싱 자체가 깨진다.
     *
     * <p>@RequestParam 필수 파라미터는 <b>Bean Validation 이 닿지 않는다.</b> 값이 아예 없을
     * 때는 물론이고 {@code ?lat=} 처럼 비어 온 경우에도 스프링이 변환 후 같은 예외를 던지므로,
     * 파라미터에 @NotNull 을 붙여 둬도 실행되지 않는다. 그래서 여기서 받는다.
     *
     * <p>어느 파라미터인지 메시지에 담는다 - 파라미터가 열 개 넘는 엔드포인트에서
     * "필수 값이 없습니다"만 받으면 무엇을 고쳐야 할지 알 수 없다.
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Response<Void>> handleMissingParameter(MissingServletRequestParameterException exception) {
        EmergencyErrorCode errorCode = EmergencyErrorCode.PARAMETER_MISSING;
        log.warn("emergency required parameter missing. name={} type={}",
            exception.getParameterName(), exception.getParameterType());
        return ResponseEntity.status(errorCode.getHttpStatus())
            .body(Response.fail(errorCode.getCode(),
                "%s (%s)".formatted(errorCode.getMessage(), exception.getParameterName())));
    }
}

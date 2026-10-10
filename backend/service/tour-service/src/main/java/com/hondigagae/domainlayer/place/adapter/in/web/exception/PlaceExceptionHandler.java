package com.hondigagae.domainlayer.place.adapter.in.web.exception;

import com.hondigagae.common.dto.Response;
import com.hondigagae.common.exception.ValidationErrorSupport;
import com.hondigagae.domainlayer.place.application.exception.PlaceErrorCode;
import com.hondigagae.domainlayer.place.application.exception.PlaceException;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Slf4j
@RestControllerAdvice(basePackages = "com.hondigagae.domainlayer")
public class PlaceExceptionHandler {

    @ExceptionHandler(PlaceException.class)
    public ResponseEntity<Response<Void>> handlePlaceException(PlaceException exception) {
        PlaceErrorCode errorCode = exception.getErrorCode();
        log.warn("place exception occurred. code={} message={}", errorCode.getCode(), errorCode.getMessage());
        return ResponseEntity.status(errorCode.getHttpStatus())
            .body(Response.fail(errorCode.getCode(), errorCode.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Response<Void>> handleValidation(MethodArgumentNotValidException exception) {
        return ValidationErrorSupport.toResponse(exception, PlaceErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Response<Void>> handleConstraintViolation(ConstraintViolationException exception) {
        return ValidationErrorSupport.toResponse(exception, PlaceErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<Response<Void>> handleHandlerMethodValidation(HandlerMethodValidationException exception) {
        return ValidationErrorSupport.toResponse(exception, PlaceErrorCode.INVALID_REQUEST.getCode());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Response<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        return ValidationErrorSupport.toResponse(exception, PlaceErrorCode.PARAMETER_TYPE_INVALID.getCode());
    }

    /** 본문을 읽지 못한 요청(깨진 JSON, enum 에 없는 값). 처리하지 않으면 Response 봉투 밖의 Spring 기본 400 이 나간다 (#214). */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Response<Void>> handleUnreadableBody(HttpMessageNotReadableException exception) {
        return ValidationErrorSupport.toResponse(exception, PlaceErrorCode.INVALID_REQUEST.getCode());
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
        PlaceErrorCode errorCode = PlaceErrorCode.PARAMETER_MISSING;
        log.warn("place required parameter missing. name={} type={}",
            exception.getParameterName(), exception.getParameterType());
        return ResponseEntity.status(errorCode.getHttpStatus())
            .body(Response.fail(errorCode.getCode(),
                "%s (%s)".formatted(errorCode.getMessage(), exception.getParameterName())));
    }
}

package com.hondigagae.domainlayer.emergency.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum EmergencyErrorCode {

    NOT_FOUND_FACILITY("EMERGENCY_001", "존재하지 않는 긴급 시설입니다.", HttpStatus.NOT_FOUND),
    INVALID_REQUEST("EMERGENCY_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("EMERGENCY_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    // 필수 쿼리 파라미터 누락. 값이 비어 온 경우(?lat=)도 스프링이 같은 예외로 처리한다.
    PARAMETER_MISSING("EMERGENCY_114", "필수 요청 파라미터가 없습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

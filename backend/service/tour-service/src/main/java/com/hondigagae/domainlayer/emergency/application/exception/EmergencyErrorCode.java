package com.hondigagae.domainlayer.emergency.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum EmergencyErrorCode {

    INVALID_REQUEST("EMERGENCY_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("EMERGENCY_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

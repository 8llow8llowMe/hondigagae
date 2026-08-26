package com.hondigagae.domainlayer.emergency.application.exception;

import lombok.Getter;

@Getter
public class EmergencyException extends RuntimeException {

    private final EmergencyErrorCode errorCode;

    public EmergencyException(EmergencyErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public EmergencyException(EmergencyErrorCode errorCode, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
    }
}

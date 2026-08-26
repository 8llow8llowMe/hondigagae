package com.hondigagae.domainlayer.dining.application.exception;

import lombok.Getter;

@Getter
public class DiningException extends RuntimeException {

    private final DiningErrorCode errorCode;

    public DiningException(DiningErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public DiningException(DiningErrorCode errorCode, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
    }
}

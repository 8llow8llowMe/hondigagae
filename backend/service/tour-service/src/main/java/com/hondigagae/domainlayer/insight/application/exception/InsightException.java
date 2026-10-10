package com.hondigagae.domainlayer.insight.application.exception;

import lombok.Getter;

@Getter
public class InsightException extends RuntimeException {

    private final InsightErrorCode errorCode;

    public InsightException(InsightErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public InsightException(InsightErrorCode errorCode, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
    }
}

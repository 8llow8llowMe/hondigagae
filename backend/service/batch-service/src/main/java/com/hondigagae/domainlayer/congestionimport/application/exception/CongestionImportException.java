package com.hondigagae.domainlayer.congestionimport.application.exception;

import lombok.Getter;

@Getter
public class CongestionImportException extends RuntimeException {

    private final CongestionImportErrorCode errorCode;

    public CongestionImportException(CongestionImportErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public CongestionImportException(CongestionImportErrorCode errorCode, String detail) {
        super(errorCode.getMessage() + " " + detail);
        this.errorCode = errorCode;
    }

    public CongestionImportException(CongestionImportErrorCode errorCode, Throwable cause, String detail) {
        super(errorCode.getMessage() + " " + detail, cause);
        this.errorCode = errorCode;
    }
}

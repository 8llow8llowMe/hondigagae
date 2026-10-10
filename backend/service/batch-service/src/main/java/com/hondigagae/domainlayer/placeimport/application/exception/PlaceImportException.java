package com.hondigagae.domainlayer.placeimport.application.exception;

import lombok.Getter;

@Getter
public class PlaceImportException extends RuntimeException {

    private final PlaceImportErrorCode errorCode;

    public PlaceImportException(PlaceImportErrorCode errorCode, Object... messageArgs) {
        super("[%s] %s".formatted(errorCode.getCode(), errorCode.getMessage().formatted(messageArgs)));
        this.errorCode = errorCode;
    }

    public PlaceImportException(PlaceImportErrorCode errorCode, Throwable cause, Object... messageArgs) {
        super("[%s] %s".formatted(errorCode.getCode(), errorCode.getMessage().formatted(messageArgs)), cause);
        this.errorCode = errorCode;
    }
}

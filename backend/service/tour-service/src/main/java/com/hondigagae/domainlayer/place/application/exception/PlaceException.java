package com.hondigagae.domainlayer.place.application.exception;

import lombok.Getter;

@Getter
public class PlaceException extends RuntimeException {

    private final PlaceErrorCode errorCode;

    public PlaceException(PlaceErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}

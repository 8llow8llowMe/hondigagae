package com.hondigagae.domainlayer.favorite.application.exception;

import lombok.Getter;

@Getter
public class FavoriteException extends RuntimeException {

    private final FavoriteErrorCode errorCode;

    public FavoriteException(FavoriteErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public FavoriteException(FavoriteErrorCode errorCode, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
    }
}

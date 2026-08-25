package com.hondigagae.security.common.exception;

import lombok.Getter;

@Getter
public class SecurityJwtException extends RuntimeException {

    private final SecurityErrorCode errorCode;

    public SecurityJwtException(SecurityErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}

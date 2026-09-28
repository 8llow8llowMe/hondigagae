package com.hondigagae.domainlayer.pet.application.exception;

import lombok.Getter;

@Getter
public class PetException extends RuntimeException {

    private final PetErrorCode errorCode;

    public PetException(PetErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    /** 내부 호출 실패처럼 원인 예외를 로그로 이어 가야 할 때. */
    public PetException(PetErrorCode errorCode, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
    }
}

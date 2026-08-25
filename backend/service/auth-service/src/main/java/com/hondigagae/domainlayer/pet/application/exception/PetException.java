package com.hondigagae.domainlayer.pet.application.exception;

import lombok.Getter;

@Getter
public class PetException extends RuntimeException {

    private final PetErrorCode errorCode;

    public PetException(PetErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}

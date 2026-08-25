package com.hondigagae.domainlayer.plan.application.exception;

import lombok.Getter;

@Getter
public class PlanException extends RuntimeException {

    private final PlanErrorCode errorCode;

    public PlanException(PlanErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public PlanException(PlanErrorCode errorCode, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
    }
}

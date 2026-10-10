package com.hondigagae.domainlayer.planner.application.exception;

import lombok.Getter;

@Getter
public class AiPlanException extends RuntimeException {

    private final AiPlanErrorCode errorCode;

    public AiPlanException(AiPlanErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public AiPlanException(AiPlanErrorCode errorCode, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
    }
}

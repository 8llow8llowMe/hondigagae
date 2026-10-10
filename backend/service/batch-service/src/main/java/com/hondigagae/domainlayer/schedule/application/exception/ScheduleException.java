package com.hondigagae.domainlayer.schedule.application.exception;

import lombok.Getter;

@Getter
public class ScheduleException extends RuntimeException {

    private final ScheduleErrorCode errorCode;

    public ScheduleException(ScheduleErrorCode errorCode, Object... messageArgs) {
        super("[%s] %s".formatted(errorCode.getCode(), errorCode.getMessage().formatted(messageArgs)));
        this.errorCode = errorCode;
    }

    public ScheduleException(ScheduleErrorCode errorCode, Throwable cause, Object... messageArgs) {
        super("[%s] %s".formatted(errorCode.getCode(), errorCode.getMessage().formatted(messageArgs)), cause);
        this.errorCode = errorCode;
    }
}

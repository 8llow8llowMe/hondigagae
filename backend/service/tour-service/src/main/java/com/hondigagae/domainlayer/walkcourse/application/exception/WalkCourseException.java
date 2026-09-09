package com.hondigagae.domainlayer.walkcourse.application.exception;

import lombok.Getter;

@Getter
public class WalkCourseException extends RuntimeException {

    private final WalkCourseErrorCode errorCode;

    public WalkCourseException(WalkCourseErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}

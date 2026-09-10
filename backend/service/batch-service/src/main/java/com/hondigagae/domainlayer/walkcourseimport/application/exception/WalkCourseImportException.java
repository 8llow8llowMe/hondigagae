package com.hondigagae.domainlayer.walkcourseimport.application.exception;

import lombok.Getter;

@Getter
public class WalkCourseImportException extends RuntimeException {

    private final WalkCourseImportErrorCode errorCode;

    public WalkCourseImportException(WalkCourseImportErrorCode errorCode, Object... messageArgs) {
        super(errorCode.getMessageTemplate().formatted(messageArgs));
        this.errorCode = errorCode;
    }

    public WalkCourseImportException(WalkCourseImportErrorCode errorCode, Throwable cause, Object... messageArgs) {
        super(errorCode.getMessageTemplate().formatted(messageArgs), cause);
        this.errorCode = errorCode;
    }
}

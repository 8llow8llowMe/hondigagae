package com.hondigagae.domainlayer.walkcourse.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum WalkCourseErrorCode {

    NOT_FOUND_WALK_COURSE("WALKCOURSE_001", "존재하지 않는 산책 코스입니다.", HttpStatus.NOT_FOUND),

    INVALID_REQUEST("WALKCOURSE_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("WALKCOURSE_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

package com.hondigagae.domainlayer.place.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum PlaceErrorCode {

    NOT_FOUND_PLACE("PLACE_002", "존재하지 않는 장소입니다.", HttpStatus.NOT_FOUND),
    CONTENT_TYPE_INVALID("PLACE_003", "지원하지 않는 콘텐츠 타입입니다.", HttpStatus.BAD_REQUEST),

    INVALID_REQUEST("PLACE_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("PLACE_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

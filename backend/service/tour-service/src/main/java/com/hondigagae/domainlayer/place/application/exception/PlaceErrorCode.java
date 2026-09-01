package com.hondigagae.domainlayer.place.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum PlaceErrorCode {

    // 비즈니스 코드가 002 부터 시작한다. 다른 도메인은 001 부터인데 여기만 다르다.
    // 맞추지 않는 이유는 프론트엔드가 이미 PLACE_002 로 분기하고 있어서다 -
    // 번호를 당기면 일관성을 얻는 대신 클라이언트를 깨뜨린다. 남는 001 은 비워 둔다.
    NOT_FOUND_PLACE("PLACE_002", "존재하지 않는 장소입니다.", HttpStatus.NOT_FOUND),
    CONTENT_TYPE_INVALID("PLACE_003", "지원하지 않는 콘텐츠 타입입니다.", HttpStatus.BAD_REQUEST),

    INVALID_REQUEST("PLACE_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("PLACE_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    // 필수 쿼리 파라미터 누락. 값이 비어 온 경우(?lat=)도 스프링이 같은 예외로 처리한다.
    PARAMETER_MISSING("PLACE_114", "필수 요청 파라미터가 없습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

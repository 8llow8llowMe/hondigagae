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
    KEYWORD_TOKEN_LIMIT_EXCEEDED("PLACE_108", "keyword는 최대 5개 단어만 가능합니다.", HttpStatus.BAD_REQUEST),
    // 목록 거리순(#1202). 기준 좌표는 둘이 함께 와야 뜻이 있다 — 하나만 오면 id 순으로 조용히 떨어뜨리지 않는다.
    COORDINATE_PAIR_REQUIRED("PLACE_109", "lat과 lng는 함께 보내야 합니다.", HttpStatus.BAD_REQUEST),
    // 거리순 커서(lastPlaceId)의 거리를 잴 수 없다. 병합·delisted 로 숨겨진 장소는 좌표가 남아 있어 여기 걸리지 않는다.
    DISTANCE_CURSOR_INVALID("PLACE_110", "lastPlaceId의 장소를 찾을 수 없거나 좌표가 없어 거리순으로 이어 갈 수 없습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("PLACE_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    // 필수 쿼리 파라미터 누락. 값이 비어 온 경우(?lat=)도 스프링이 같은 예외로 처리한다.
    PARAMETER_MISSING("PLACE_114", "필수 요청 파라미터가 없습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

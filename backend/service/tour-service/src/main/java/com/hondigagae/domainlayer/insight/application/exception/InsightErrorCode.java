package com.hondigagae.domainlayer.insight.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum InsightErrorCode {

    NOT_FOUND_PLACE("INSIGHT_001", "존재하지 않는 장소입니다.", HttpStatus.NOT_FOUND),
    PLACE_COORDINATE_MISSING("INSIGHT_002", "좌표가 없는 장소는 날씨 기반 분석을 제공할 수 없습니다.", HttpStatus.UNPROCESSABLE_ENTITY),
    WEATHER_UNAVAILABLE("INSIGHT_003", "날씨 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.", HttpStatus.SERVICE_UNAVAILABLE),
    WEATHER_SERVICE_KEY_MISSING("INSIGHT_004", "날씨 서비스 설정이 완료되지 않았습니다.", HttpStatus.SERVICE_UNAVAILABLE),

    DATE_RANGE_INVALID("INSIGHT_002", "조회 종료일은 시작일보다 앞설 수 없습니다.", HttpStatus.BAD_REQUEST),
    INVALID_REQUEST("INSIGHT_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("INSIGHT_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    // 필수 쿼리 파라미터 누락. 값이 비어 온 경우(?lat=)도 스프링이 같은 예외로 처리한다.
    PARAMETER_MISSING("INSIGHT_114", "필수 요청 파라미터가 없습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

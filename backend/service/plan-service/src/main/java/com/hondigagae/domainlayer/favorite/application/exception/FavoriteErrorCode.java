package com.hondigagae.domainlayer.favorite.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum FavoriteErrorCode {

    NOT_FOUND_PLACE("FAVORITE_001", "즐겨찾기할 장소를 찾을 수 없습니다.", HttpStatus.BAD_REQUEST),
    FAVORITE_LIMIT_EXCEEDED("FAVORITE_002", "저장할 수 있는 즐겨찾기 수를 초과했습니다.", HttpStatus.BAD_REQUEST),

    INVALID_REQUEST("FAVORITE_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("FAVORITE_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_REQUIRED("FAVORITE_114", "필수 요청 파라미터가 누락되었습니다.", HttpStatus.BAD_REQUEST),

    INTERNAL_SERVICE_UNAVAILABLE("FAVORITE_900", "내부 서비스 연동에 실패했습니다. 잠시 후 다시 시도해주세요.", HttpStatus.SERVICE_UNAVAILABLE);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

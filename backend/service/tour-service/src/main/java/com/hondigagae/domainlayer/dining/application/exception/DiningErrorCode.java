package com.hondigagae.domainlayer.dining.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum DiningErrorCode {

    NEARBY_SEARCH_UNAVAILABLE("DINING_001", "주변 검색을 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.", HttpStatus.SERVICE_UNAVAILABLE),
    SEARCH_KEY_MISSING("DINING_002", "주변 검색이 설정되지 않았습니다.", HttpStatus.SERVICE_UNAVAILABLE),

    // 요청 검증(Bean Validation) 대역 — 1xx. 필드별 코드는 DiningValidationMessage 가 단일 기준점이다.
    INVALID_REQUEST("DINING_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("DINING_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

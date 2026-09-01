package com.hondigagae.domainlayer.pet.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum PetErrorCode {

    // 남의 반려견 조회도 404로 응답해 존재 자체를 노출하지 않는다.
    NOT_FOUND_PET("PET_001", "존재하지 않는 반려견입니다.", HttpStatus.NOT_FOUND),
    PET_LIMIT_EXCEEDED("PET_002", "등록할 수 있는 반려견 수를 초과했습니다.", HttpStatus.BAD_REQUEST),

    // 요청 검증(Bean Validation) 대역 — 1xx. 필드별 코드는 PetValidationMessage가 단일 기준점이다.
    INVALID_REQUEST("PET_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("PET_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_REQUIRED("PET_114", "필수 요청 파라미터가 누락되었습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

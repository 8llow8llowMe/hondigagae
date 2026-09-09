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
    BIRTH_YM_IN_FUTURE("PET_003", "생년월은 미래일 수 없습니다.", HttpStatus.BAD_REQUEST),
    // 30kg 소형견이 저장되면 적합도 판정이 "소형견만 가능" 장소를 동반 가능으로 읽는다 (#364).
    WEIGHT_SIZE_MISMATCH("PET_004", "체중과 크기 구분이 맞지 않습니다. 소형견 10kg 미만 · 중형견 10~25kg 미만 · 대형견 25kg 이상 기준으로 선택해 주세요.",
        HttpStatus.BAD_REQUEST),

    // 요청 검증(Bean Validation) 대역 — 1xx. 필드별 코드는 PetValidationMessage가 단일 기준점이다.
    INVALID_REQUEST("PET_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("PET_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_REQUIRED("PET_114", "필수 요청 파라미터가 누락되었습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

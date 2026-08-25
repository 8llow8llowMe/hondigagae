package com.hondigagae.domainlayer.member.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum MemberErrorCode {

    NOT_FOUND_MEMBER("MEMBER_001", "존재하지 않는 회원입니다", HttpStatus.NOT_FOUND),
    MEMBER_ALREADY_WITHDRAWN("MEMBER_002", "이미 탈퇴한 회원입니다.", HttpStatus.BAD_REQUEST),

    // 요청 검증(Bean Validation) 대역 — 1xx.
    INVALID_REQUEST("MEMBER_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("MEMBER_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

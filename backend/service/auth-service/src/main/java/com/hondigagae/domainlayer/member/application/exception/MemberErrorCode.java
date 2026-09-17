package com.hondigagae.domainlayer.member.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum MemberErrorCode {

    EXIST_MEMBER_EMAIL("MEMBER_001", "이미 가입된 이메일 (%s)입니다.", HttpStatus.CONFLICT),
    NOT_FOUND_MEMBER("MEMBER_002", "존재하지 않는 회원입니다", HttpStatus.NOT_FOUND),
    NOT_MATCH_PASSWORD("MEMBER_003", "비밀번호가 일치하지 않습니다.", HttpStatus.BAD_REQUEST),
    MEMBER_ALREADY_WITHDRAWN("MEMBER_004", "이미 탈퇴한 회원입니다.", HttpStatus.BAD_REQUEST),
    MEMBER_SUSPENDED("MEMBER_005", "정지된 회원입니다.", HttpStatus.FORBIDDEN),
    EMAIL_NOT_VERIFIED("MEMBER_006", "이메일 인증이 완료되지 않았습니다. 인증 후 다시 시도해주세요.", HttpStatus.BAD_REQUEST),
    SOCIAL_ACCOUNT_PASSWORD_UNSUPPORTED("MEMBER_007", "소셜 로그인 계정은 비밀번호를 사용하지 않습니다.", HttpStatus.BAD_REQUEST),
    PASSWORD_ALREADY_SET("MEMBER_008", "이미 비밀번호가 설정된 계정입니다. 비밀번호 변경을 이용해주세요.", HttpStatus.BAD_REQUEST),
    // 마지막 로그인 수단 제거 방지 — 소셜이 연결되지 않은 일반 계정의 비밀번호를 지우면 로그인이 불가능해진다.
    PASSWORD_REMOVAL_NOT_ALLOWED("MEMBER_009", "소셜 로그인이 연결된 계정만 비밀번호를 제거할 수 있습니다.", HttpStatus.BAD_REQUEST),
    // 소셜 최초 연동 경로 전용. 일반 가입은 @AssertTrue(MEMBER_115/116)가 web 경계에서 막지만,
    // 소셜은 동의를 /authorize 에서 미리 받아 두므로 콜백 시점에야 누락을 알 수 있다.
    CONSENT_REQUIRED("MEMBER_010", "이용약관과 개인정보 처리방침에 동의해야 가입할 수 있습니다.", HttpStatus.BAD_REQUEST),

    // 요청 검증(Bean Validation) 대역 — 1xx.
    // 필드별 코드(MEMBER_101~112, 115~116)는 MemberValidationMessage 가 단일 기준점이며, 여기서는 중복 정의하지 않는다.
    INVALID_REQUEST("MEMBER_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("MEMBER_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_REQUIRED("MEMBER_114", "필수 요청 파라미터가 누락되었습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

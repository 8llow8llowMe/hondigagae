package com.hondigagae.domainlayer.auth.application.exception;

/**
 * 인증 요청 검증 메시지 카탈로그 (AUTH_1xx).
 *
 * <p>Bean Validation의 {@code message}는 컴파일 상수만 받을 수 있어 enum을 직접 쓸 수 없다.
 * 코드와 메시지를 이 상수에 모아 DTO가 참조하게 하면, 오타나 삭제를 컴파일러가 잡고
 * 코드-메시지의 단일 기준점이 유지된다.
 *
 * <p>형식: {@code "코드:사용자 메시지"} — ValidationErrorSupport가 접두어를 분리한다.
 */
public final class AuthValidationMessage {

    public static final String EMAIL_REQUIRED = "AUTH_101:이메일은 필수입니다.";
    public static final String EMAIL_FORMAT_INVALID = "AUTH_102:이메일 형식이 올바르지 않습니다.";
    public static final String PASSWORD_REQUIRED = "AUTH_103:비밀번호는 필수입니다.";
    public static final String EMAIL_CODE_REQUIRED = "AUTH_104:인증코드는 필수입니다.";
    // 비밀번호 재설정 요청용 — 규칙은 member 의 비밀번호 정책과 동일하게 유지한다.
    public static final String NEW_PASSWORD_REQUIRED = "AUTH_106:새 비밀번호는 필수입니다.";
    public static final String PASSWORD_LENGTH_INVALID = "AUTH_107:비밀번호는 8자 이상 20자 이하여야 합니다.";
    public static final String PASSWORD_PATTERN_INVALID = "AUTH_108:비밀번호는 공백 없이 영문자, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다.";

    private AuthValidationMessage() {
    }
}

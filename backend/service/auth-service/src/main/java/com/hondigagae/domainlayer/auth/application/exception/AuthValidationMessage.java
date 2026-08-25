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

    public static final String AUTH_CODE_REQUIRED = "AUTH_101:카카오 인가코드는 필수입니다.";
    public static final String STATE_REQUIRED = "AUTH_102:state는 필수입니다.";

    private AuthValidationMessage() {
    }
}

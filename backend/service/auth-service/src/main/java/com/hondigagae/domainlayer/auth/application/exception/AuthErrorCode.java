package com.hondigagae.domainlayer.auth.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum AuthErrorCode {

    EXPIRED_REFRESH_TOKEN("AUTH_001", "로그인 정보가 만료되었습니다. 다시 로그인해주세요.", HttpStatus.UNAUTHORIZED),
    INVALID_REFRESH_TOKEN("AUTH_002", "유효하지 않은 Refresh Token입니다.", HttpStatus.UNAUTHORIZED),
    INVALID_OAUTH_STATE("AUTH_003", "유효하지 않은 소셜 로그인 요청입니다. 처음부터 다시 시도해주세요.", HttpStatus.UNAUTHORIZED),
    OAUTH_AUTHORIZATION_FAILED("AUTH_004", "소셜 로그인 인증에 실패했습니다. 처음부터 다시 시도해주세요.", HttpStatus.BAD_REQUEST),
    OAUTH_PROVIDER_UNAVAILABLE("AUTH_005", "소셜 로그인 제공자와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.", HttpStatus.BAD_GATEWAY),
    OAUTH_PROFILE_REQUIRED("AUTH_006", "카카오 계정의 프로필(닉네임) 제공 동의가 필요합니다.", HttpStatus.BAD_REQUEST),

    // 요청 검증(Bean Validation) 대역 — 1xx.
    // 필드별 코드(AUTH_101~102)는 AuthValidationMessage 가 단일 기준점이며, 여기서는 중복 정의하지 않는다.
    INVALID_REQUEST("AUTH_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("AUTH_105", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

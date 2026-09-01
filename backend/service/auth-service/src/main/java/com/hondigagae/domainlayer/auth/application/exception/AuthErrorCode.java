package com.hondigagae.domainlayer.auth.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum AuthErrorCode {

    EXPIRED_REFRESH_TOKEN("AUTH_001", "로그인 정보가 만료되었습니다. 다시 로그인해주세요.", HttpStatus.UNAUTHORIZED),
    INVALID_REFRESH_TOKEN("AUTH_002", "유효하지 않은 Refresh Token입니다.", HttpStatus.UNAUTHORIZED),
    EMAIL_CODE_COOLDOWN("AUTH_003", "인증코드 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.", HttpStatus.TOO_MANY_REQUESTS),
    INVALID_EMAIL_CODE("AUTH_004", "인증코드가 일치하지 않습니다.", HttpStatus.BAD_REQUEST),
    EXPIRED_EMAIL_CODE("AUTH_005", "인증코드가 만료되었거나 발급되지 않았습니다. 다시 요청해주세요.", HttpStatus.BAD_REQUEST),
    // 계정 열거(존재 여부 탐색) 방지를 위해 미존재/비밀번호 불일치를 하나의 응답으로 통합한다.
    LOGIN_FAILED("AUTH_006", "이메일 또는 비밀번호가 올바르지 않습니다.", HttpStatus.UNAUTHORIZED),
    UNSUPPORTED_OAUTH_PROVIDER("AUTH_007", "지원하지 않는 소셜 로그인 제공자입니다. (%s)", HttpStatus.BAD_REQUEST),
    UNMATCHED_OAUTH_PROVIDER("AUTH_008", "이미 %s(으)로 가입된 계정입니다. 해당 소셜 로그인을 이용해주세요.", HttpStatus.CONFLICT),
    OAUTH_EMAIL_REQUIRED("AUTH_009", "소셜 계정의 이메일 제공 동의가 필요합니다.", HttpStatus.BAD_REQUEST),
    INVALID_OAUTH_STATE("AUTH_010", "유효하지 않은 소셜 로그인 요청입니다. 처음부터 다시 시도해주세요.", HttpStatus.UNAUTHORIZED),
    OAUTH_PROFILE_REQUIRED("AUTH_011", "소셜 계정의 프로필(닉네임) 제공 동의가 필요합니다.", HttpStatus.BAD_REQUEST),
    OAUTH_EMAIL_UNVERIFIED("AUTH_012", "소셜 계정의 이메일이 인증되지 않았습니다. 제공자에서 이메일 인증 후 다시 시도해주세요.", HttpStatus.BAD_REQUEST),
    OAUTH_AUTHORIZATION_FAILED("AUTH_013", "소셜 로그인 인증에 실패했습니다. 처음부터 다시 시도해주세요.", HttpStatus.BAD_REQUEST),
    OAUTH_PROVIDER_UNAVAILABLE("AUTH_014", "소셜 로그인 제공자와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.", HttpStatus.BAD_GATEWAY),
    // 로그인 실패 횟수 초과 잠금. 메시지에 계정 존재 여부/잠금 사유를 담지 않는다 —
    // 미존재 이메일도 동일하게 잠기므로 이 응답이 "이 이메일은 가입돼 있다"는 신호가 되지 않아야 한다.
    LOGIN_ATTEMPT_LOCKED("AUTH_015", "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.", HttpStatus.TOO_MANY_REQUESTS),
    // 미인증 이메일 발송 API 의 IP 기준 상한 초과. 이메일 쿨다운(AUTH_003)과 별개의 남용 방어다.
    EMAIL_SEND_IP_LIMITED("AUTH_016", "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", HttpStatus.TOO_MANY_REQUESTS),
    // 비밀번호 재설정 코드 검증 실패 누적 — 브루트포스 방어로 코드를 무효화하고 재요청을 유도한다.
    PASSWORD_RESET_ATTEMPTS_EXCEEDED("AUTH_017", "인증코드 시도 횟수를 초과했습니다. 인증코드를 다시 요청해주세요.", HttpStatus.BAD_REQUEST),

    // 요청 검증(Bean Validation) 대역 — 1xx.
    // 필드별 코드(AUTH_101~104)는 AuthValidationMessage 가 단일 기준점이며, 여기서는 중복 정의하지 않는다.
    INVALID_REQUEST("AUTH_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    // AUTH_105 는 결번 — 과거 PARAMETER_TYPE_INVALID 자리였으나 필드별 코드(101~108) 중간에 끼어 있어
    // §8-2 의 "프레임워크 공통 코드는 1xx 대역 끝" 규약에 맞게 뒤로 옮겼다. 재사용하지 않는다.
    PARAMETER_TYPE_INVALID("AUTH_109", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_REQUIRED("AUTH_110", "필수 요청 파라미터가 누락되었습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}

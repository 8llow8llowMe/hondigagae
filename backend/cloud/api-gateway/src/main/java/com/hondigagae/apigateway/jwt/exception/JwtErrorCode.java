package com.hondigagae.apigateway.jwt.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum JwtErrorCode {

    TOKEN_EXPIRED("JWT_001", "토큰이 만료되었습니다.", HttpStatus.UNAUTHORIZED),
    TOKEN_INVALID("JWT_002", "토큰이 유효하지 않습니다.", HttpStatus.UNAUTHORIZED),
    TOKEN_SIGNATURE_INVALID("JWT_003", "토큰 서명 검증에 실패했습니다.", HttpStatus.UNAUTHORIZED),
    TOKEN_MALFORMED("JWT_004", "토큰 형식이 올바르지 않습니다.", HttpStatus.UNAUTHORIZED),
    TOKEN_REVOKED("JWT_005", "로그아웃 처리된 Access Token입니다.", HttpStatus.UNAUTHORIZED),
    TOKEN_VERIFICATION_UNAVAILABLE("JWT_006", "토큰 검증 서비스를 일시적으로 사용할 수 없습니다.", HttpStatus.SERVICE_UNAVAILABLE);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}
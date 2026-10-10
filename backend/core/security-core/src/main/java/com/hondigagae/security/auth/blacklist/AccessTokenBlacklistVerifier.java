package com.hondigagae.security.auth.blacklist;

/**
 * Access Token(jti)의 블랙리스트 등록 여부를 조회하는 계약.
 *
 * auth-service는 API Gateway를 거치지 않고 직접 호출되므로, 게이트웨이의 블랙리스트 검증을
 * 받지 못한다. 이 인터페이스 구현 빈이 존재하면 JwtAuthFilter가 토큰 파싱 후 블랙리스트를
 * 함께 검증한다(구현 빈이 없으면 기존 동작 유지).
 */
public interface AccessTokenBlacklistVerifier {

    boolean isRevoked(String tokenId);
}

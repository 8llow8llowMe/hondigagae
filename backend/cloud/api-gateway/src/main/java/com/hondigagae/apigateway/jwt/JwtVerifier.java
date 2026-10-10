package com.hondigagae.apigateway.jwt;

import com.hondigagae.apigateway.jwt.properties.JwtVerificationProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtVerifier {

    private final JwtVerificationProperties jwtVerificationProperties;

    public Claims validateAndGetClaims(String token) {
        try {
            return parseClaims(token);
        } catch (ExpiredJwtException e) {
            log.warn("[JwtVerifier] 토큰 만료: {}", e.getMessage());
            throw e;
        } catch (SignatureException e) {
            log.warn("[JwtVerifier] 토큰 서명 검증 실패: {}", e.getMessage());
            throw e;
        } catch (MalformedJwtException e) {
            log.warn("[JwtVerifier] 토큰 형식 오류: {}", e.getMessage());
            throw e;
        } catch (SecurityException | IllegalArgumentException e) {
            log.warn("[JwtVerifier] 토큰 유효성 검증 실패: {}", e.getMessage());
            throw e;
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
            .verifyWith(Keys.hmacShaKeyFor(jwtVerificationProperties.accessKey().getBytes()))
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
package com.hondigagae.security.auth.jwt;

import com.hondigagae.security.common.dto.MemberLoginActive;
import com.hondigagae.security.common.enums.SecurityRole;
import com.hondigagae.security.common.exception.SecurityErrorCode;
import com.hondigagae.security.common.exception.SecurityJwtException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.Jwts.SIG;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import java.time.Duration;
import java.util.Date;
import java.util.UUID;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class JwtAuthProvider {

    private static final String CLAIM_ROLE = "role";
    private final JwtAuthProperties jwtAuthProperties;

    public String issueAccessToken(long memberId, SecurityRole role) {
        Claims claims = Jwts.claims()
            .id(UUID.randomUUID().toString())
            .subject(String.valueOf(memberId))
            .add(CLAIM_ROLE, role)
            .build();

        return issueToken(claims, jwtAuthProperties.accessExpiration(), jwtAuthProperties.accessKey());
    }

    public String issueRefreshToken(long memberId) {
        return issueRefreshToken(memberId, UUID.randomUUID().toString());
    }

    /**
     * 지정한 tokenId(jti)로 refresh 토큰을 발급한다.
     * 토큰 회전 시 같은 세션 아이디를 유지해 기기별 세션 저장 키가 흔들리지 않게 하기 위한 오버로드다.
     */
    public String issueRefreshToken(long memberId, String tokenId) {
        Claims claims = Jwts.claims()
            .id(tokenId)
            .subject(String.valueOf(memberId))
            .build();

        return issueToken(claims, jwtAuthProperties.refreshExpiration(), jwtAuthProperties.refreshKey());
    }

    public RefreshTokenClaims parseRefreshToken(String refreshToken) {
        Claims payload = parseToken(refreshToken, jwtAuthProperties.refreshKey());
        return new RefreshTokenClaims(Long.parseLong(payload.getSubject()), payload.getId());
    }

    /** refresh 토큰의 핵심 클레임. tokenId(jti)는 기기별 세션 식별자로 쓴다. */
    public record RefreshTokenClaims(long memberId, String tokenId) {
    }

    public MemberLoginActive parseAccessToken(String accessToken) {
        Claims payload = parseToken(accessToken, jwtAuthProperties.accessKey());

        return MemberLoginActive.builder()
            .memberId(Long.parseLong(payload.getSubject()))
            .role(SecurityRole.from(payload.get(CLAIM_ROLE, String.class)))
            .tokenId(payload.getId())
            .build();
    }

    private String issueToken(Claims claims, Duration expiration, String secretKey) {
        Date now = new Date();

        return Jwts.builder()
            .claims(claims)
            .issuedAt(now)
            .expiration(new Date(now.getTime() + expiration.toMillis()))
            .signWith(Keys.hmacShaKeyFor(secretKey.getBytes()), SIG.HS512)
            .compact();
    }

    private Claims parseToken(String token, String secretKey) {
        Claims payload;

        try {
            payload = Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(secretKey.getBytes()))
                .build()
                .parseSignedClaims(token).getPayload();
        } catch (ExpiredJwtException e) {
            throw new SecurityJwtException(SecurityErrorCode.TOKEN_EXPIRED);
        } catch (MalformedJwtException | SecurityException | IllegalArgumentException e) {
            throw new SecurityJwtException(SecurityErrorCode.TOKEN_INVALID);
        } catch (SignatureException e) {
            throw new SecurityJwtException(SecurityErrorCode.TOKEN_SIGNATURE_INVALID);
        }

        return payload;
    }
}


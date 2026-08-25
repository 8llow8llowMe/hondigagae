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
        Claims claims = Jwts.claims()
            .id(UUID.randomUUID().toString())
            .subject(String.valueOf(memberId))
            .build();

        return issueToken(claims, jwtAuthProperties.refreshExpiration(), jwtAuthProperties.refreshKey());
    }

    public long parseRefreshToken(String refreshToken) {
        Claims payload = parseToken(refreshToken, jwtAuthProperties.refreshKey());
        return Long.parseLong(payload.getSubject());
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


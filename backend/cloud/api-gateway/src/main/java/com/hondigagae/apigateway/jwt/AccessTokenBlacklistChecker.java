package com.hondigagae.apigateway.jwt;

import com.hondigagae.apigateway.jwt.exception.JwtErrorCode;
import com.hondigagae.apigateway.jwt.exception.JwtException;
import com.hondigagae.apigateway.jwt.properties.JwtVerificationProperties;
import com.hondigagae.redis.properties.RedisProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AccessTokenBlacklistChecker {

    private final RedisTemplate<String, Object> redisTemplate;
    private final JwtVerificationProperties jwtVerificationProperties;
    private final RedisProperties redisProperties;

    /**
     * 로그아웃(블랙리스트)된 토큰인지.
     *
     * <p><b>블로킹 호출이다.</b> 리액티브 체인에서는 이벤트 루프 밖({@code boundedElastic})에서 부른다 —
     * {@code JwtAuthApiGatewayFilter#rejectIfRevoked}.
     *
     * <p>Redis 를 읽지 못하면 <b>모양과 상관없이 같은 규칙</b>을 따른다 (#1253) — 기본 fail-closed(503 SECURITY_008),
     * {@code jwt.blacklist-fail-open} 이면 통과. 그래서 {@link DataAccessException} 전체를 잡는다 — auth-service
     * {@code RedisJwtTokenStoreAdapter#isRevoked} 와 같은 범위다. 대표적인 모양은 셋이다.
     * <ul>
     *   <li>{@link RedisConnectionFailureException} — 연결 거부 · 연결 타임아웃({@code infra.redis.connect-timeout})</li>
     *   <li>{@link QueryTimeoutException} — 연결은 됐는데 답이 없다({@code infra.redis.command-timeout}). Lettuce 의
     *       {@code RedisCommandTimeoutException} 을 Spring Data Redis 가 이것으로 번역한다</li>
     *   <li>{@code RedisSystemException} — Redis 가 오류로 답한다(LOADING · READONLY · NOAUTH 등)</li>
     * </ul>
     * 셋은 Spring 예외 계층이 갈라져 있어서, 연결 실패만 잡던 때는 나머지가 그대로 새어 <b>500</b> 이 됐다.
     */
    public boolean isBlacklisted(String tokenId) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(buildKey(tokenId)));
        } catch (DataAccessException e) {
            log.error("[AccessTokenBlacklistChecker] Redis 블랙리스트 조회 실패: errorType={} error={}", e.getClass().getSimpleName(), e.getMessage());
            if (jwtVerificationProperties.blacklistFailOpen()) {
                return false;
            }
            throw new JwtException(JwtErrorCode.TOKEN_VERIFICATION_UNAVAILABLE);
        }
    }

    private String buildKey(String tokenId) {
        return redisProperties.normalizedKeyPrefix() + ":auth:accessTokenBlacklist:" + tokenId;
    }
}

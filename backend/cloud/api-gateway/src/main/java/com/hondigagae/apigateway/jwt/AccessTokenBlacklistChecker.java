package com.hondigagae.apigateway.jwt;

import com.hondigagae.apigateway.jwt.exception.JwtErrorCode;
import com.hondigagae.apigateway.jwt.exception.JwtException;
import com.hondigagae.apigateway.jwt.properties.JwtVerificationProperties;
import com.hondigagae.redis.properties.RedisProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    public boolean isBlacklisted(String tokenId) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(buildKey(tokenId)));
        } catch (RedisConnectionFailureException e) {
            log.error("[AccessTokenBlacklistChecker] Redis 블랙리스트 조회 실패: error={}", e.getMessage());
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

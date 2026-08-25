package com.hondigagae.domainlayer.auth.adapter.out.persistence;

import com.hondigagae.domainlayer.auth.application.port.out.JwtTokenStorePort;
import com.hondigagae.redis.properties.RedisProperties;
import com.hondigagae.security.auth.blacklist.AccessTokenBlacklistVerifier;
import com.hondigagae.security.auth.jwt.JwtAuthProperties;
import com.hondigagae.security.common.exception.SecurityErrorCode;
import com.hondigagae.security.common.exception.SecurityJwtException;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RedisJwtTokenStoreAdapter implements JwtTokenStorePort, AccessTokenBlacklistVerifier {

    private static final String BLACKLIST_VALUE = "logout";

    private final RedisTemplate<String, String> redisTemplate;
    private final JwtAuthProperties jwtAuthProperties;
    private final RedisProperties redisProperties;

    // 게이트웨이의 JWT_BLACKLIST_FAIL_OPEN 정책과 동일한 키로 정렬한다. (기본 fail-closed)
    @Value("${jwt.blacklist-fail-open:false}")
    private boolean blacklistFailOpen;

    @Override
    public void save(long memberId, String refreshToken) {
        try {
            redisTemplate.opsForValue().set(
                buildRefreshKey(memberId),
                refreshToken,
                jwtAuthProperties.refreshExpiration()
            );
        } catch (RedisConnectionFailureException e) {
            log.error("[RedisJwtTokenStoreAdapter] RefreshToken 저장 실패: memberId={}, error={}",
                memberId, e.getMessage());
        }
    }

    @Override
    public Optional<String> find(long memberId) {
        try {
            String token = redisTemplate.opsForValue().get(buildRefreshKey(memberId));
            return Optional.ofNullable(token);
        } catch (RedisConnectionFailureException e) {
            log.error("[RedisJwtTokenStoreAdapter] RefreshToken 조회 실패: memberId={}, error={}",
                memberId, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 세션 무효화(탈퇴/로그아웃)의 핵심 연산이므로 Redis 실패를 삼키지 않고 전파한다.
     * 관용 처리가 필요한 호출부(로그아웃)는 상위에서 예외를 처리한다.
     */
    @Override
    public void delete(long memberId) {
        redisTemplate.delete(buildRefreshKey(memberId));
    }

    @Override
    public void saveAccessTokenIdBlacklist(String tokenId, Duration ttl) {
        redisTemplate.opsForValue().set(buildBlacklistKey(tokenId), BLACKLIST_VALUE, ttl);
    }

    @Override
    public boolean isRevoked(String tokenId) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(buildBlacklistKey(tokenId)));
        } catch (DataAccessException e) {
            log.error("[RedisJwtTokenStoreAdapter] AccessToken 블랙리스트 조회 실패: error={}", e.getMessage());
            if (blacklistFailOpen) {
                // fail-open: Redis 장애 시 인증 마비를 피하고 통과시킨다.
                return false;
            }
            // fail-closed(기본): 게이트웨이 정책과 동일하게 503으로 응답한다.
            throw new SecurityJwtException(SecurityErrorCode.TOKEN_VERIFICATION_UNAVAILABLE);
        }
    }

    private String buildRefreshKey(long memberId) {
        return buildKey("auth", "refreshToken", String.valueOf(memberId));
    }

    private String buildBlacklistKey(String tokenId) {
        return buildKey("auth", "accessTokenBlacklist", tokenId);
    }

    private String buildKey(String domain, String type, String id) {
        return redisProperties.normalizedKeyPrefix() + ":" + domain + ":" + type + ":" + id;
    }
}

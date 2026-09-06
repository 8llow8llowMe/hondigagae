package com.hondigagae.domainlayer.auth.adapter.out.persistence;

import com.hondigagae.domainlayer.auth.application.port.out.JwtTokenStorePort;
import com.hondigagae.domainlayer.auth.application.port.out.query.RefreshSessionQueryResult;
import com.hondigagae.global.properties.AuthSessionProperties;
import com.hondigagae.redis.properties.RedisProperties;
import com.hondigagae.security.auth.blacklist.AccessTokenBlacklistVerifier;
import com.hondigagae.security.auth.jwt.JwtAuthProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import com.hondigagae.security.common.exception.SecurityErrorCode;
import com.hondigagae.security.common.exception.SecurityJwtException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

/**
 * 기기(세션)별 refresh 토큰 저장소.
 *
 * <ul>
 *   <li>{@code {prefix}:auth:refreshToken:{memberId}:{sessionId}} — 세션별 refresh 토큰, TTL = refresh 만료</li>
 *   <li>{@code {prefix}:auth:refreshSessions:{memberId}} — 세션 아이디 ZSET (score = 마지막 갱신 시각).
 *       상한 초과 시 가장 오래 갱신되지 않은 세션부터 밀어내는 인덱스</li>
 * </ul>
 *
 * <p>토큰 키가 TTL 로 먼저 사라져 인덱스에 세션 아이디만 남을 수 있지만, 조회는 항상 토큰 키
 * 기준이라 정합성 문제가 없고 잔여 항목은 밀어내기/전체 삭제 때 함께 정리된다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RedisJwtTokenStoreAdapter implements JwtTokenStorePort, AccessTokenBlacklistVerifier {

    private static final String BLACKLIST_VALUE = "logout";

    /**
     * 회전 전용 compare-and-delete. GET/비교/DEL 을 클라이언트에서 나눠 하면 그 사이에 다른
     * 재발급이 끼어들 수 있어 Lua 로 원자화한다. KEYS[1]=refresh 키, KEYS[2]=세션 인덱스,
     * ARGV[1]=기대 토큰, ARGV[2]=sessionId.
     */
    private static final DefaultRedisScript<Long> DELETE_IF_TOKEN_MATCHES = new DefaultRedisScript<>(
        """
        if redis.call('GET', KEYS[1]) == ARGV[1] then
          redis.call('DEL', KEYS[1])
          redis.call('ZREM', KEYS[2], ARGV[2])
          return 1
        end
        return 0
        """, Long.class);

    private final RedisTemplate<String, String> redisTemplate;
    private final JwtAuthProperties jwtAuthProperties;
    private final RedisProperties redisProperties;
    private final AuthSessionProperties authSessionProperties;

    // 게이트웨이의 JWT_BLACKLIST_FAIL_OPEN 정책과 동일한 키로 정렬한다. (기본 fail-closed)
    @Value("${jwt.blacklist-fail-open:false}")
    private boolean blacklistFailOpen;

    /**
     * 저장 실패를 삼키지 않는다 — 삼키면 로그인은 200 인데 세션이 Redis 에 없어, 첫 재발급에서
     * 원인 불명의 강제 재로그인이 된다. 실패가 로그인 실패(5xx)로 드러나야 사용자와 운영자가
     * 원인을 볼 수 있다 (이메일 인증코드 어댑터와 같은 정책).
     */
    @Override
    public void save(long memberId, String sessionId, String refreshToken) {
        Duration ttl = jwtAuthProperties.refreshExpiration();
        redisTemplate.opsForValue().set(buildRefreshKey(memberId, sessionId), refreshToken, ttl);

        // 세션 인덱스 갱신 — score 를 현재 시각으로 올려 "가장 오래 갱신되지 않은" 순서를 유지한다.
        String sessionsKey = buildSessionsKey(memberId);
        redisTemplate.opsForZSet().add(sessionsKey, sessionId, System.currentTimeMillis());
        redisTemplate.expire(sessionsKey, ttl);

        evictOldestSessionsOverLimit(memberId, sessionsKey);
    }

    @Override
    public Optional<String> find(long memberId, String sessionId) {
        try {
            String token = redisTemplate.opsForValue().get(buildRefreshKey(memberId, sessionId));
            return Optional.ofNullable(token);
        } catch (RedisConnectionFailureException e) {
            log.error("[RedisJwtTokenStoreAdapter] RefreshToken 조회 실패: memberId={}, error={}",
                memberId, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 세션 무효화의 핵심 연산이므로 Redis 실패를 삼키지 않고 전파한다.
     * 관용 처리가 필요한 호출부(로그아웃)는 상위에서 예외를 처리한다.
     */
    @Override
    public List<RefreshSessionQueryResult> findSessions(long memberId) {
        String sessionsKey = buildSessionsKey(memberId);
        Set<ZSetOperations.TypedTuple<String>> tuples =
            redisTemplate.opsForZSet().reverseRangeWithScores(sessionsKey, 0, -1);
        if (tuples == null || tuples.isEmpty()) {
            return List.of();
        }
        List<RefreshSessionQueryResult> sessions = new ArrayList<>();
        for (ZSetOperations.TypedTuple<String> tuple : tuples) {
            String sessionId = tuple.getValue();
            if (sessionId == null) {
                continue;
            }
            // refresh 키는 TTL 로 만료되지만 ZSET 항목은 남을 수 있다. 목록 조회 시 자가 치유한다.
            if (!Boolean.TRUE.equals(redisTemplate.hasKey(buildRefreshKey(memberId, sessionId)))) {
                redisTemplate.opsForZSet().remove(sessionsKey, sessionId);
                continue;
            }
            long epochMillis = tuple.getScore() == null ? 0L : tuple.getScore().longValue();
            sessions.add(RefreshSessionQueryResult.builder()
                .sessionId(sessionId)
                .lastRefreshedAt(Instant.ofEpochMilli(epochMillis))
                .build());
        }
        return List.copyOf(sessions);
    }

    @Override
    public void deleteSession(long memberId, String sessionId) {
        redisTemplate.delete(buildRefreshKey(memberId, sessionId));
        redisTemplate.opsForZSet().remove(buildSessionsKey(memberId), sessionId);
    }

    @Override
    public boolean deleteSessionIfTokenMatches(long memberId, String sessionId, String expectedToken) {
        Long deleted = redisTemplate.execute(
            DELETE_IF_TOKEN_MATCHES,
            List.of(buildRefreshKey(memberId, sessionId), buildSessionsKey(memberId)),
            expectedToken, sessionId);
        return deleted != null && deleted == 1L;
    }

    @Override
    public void deleteAllSessions(long memberId) {
        String sessionsKey = buildSessionsKey(memberId);
        Set<String> sessionIds = redisTemplate.opsForZSet().range(sessionsKey, 0, -1);
        if (sessionIds != null) {
            for (String sessionId : sessionIds) {
                redisTemplate.delete(buildRefreshKey(memberId, sessionId));
            }
        }
        redisTemplate.delete(sessionsKey);
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

    private void evictOldestSessionsOverLimit(long memberId, String sessionsKey) {
        Long count = redisTemplate.opsForZSet().zCard(sessionsKey);
        long overflow = (count == null ? 0 : count) - authSessionProperties.maxDevices();
        if (overflow <= 0) {
            return;
        }
        Set<String> oldest = redisTemplate.opsForZSet().range(sessionsKey, 0, overflow - 1);
        if (oldest == null || oldest.isEmpty()) {
            return;
        }
        for (String sessionId : oldest) {
            redisTemplate.delete(buildRefreshKey(memberId, sessionId));
        }
        redisTemplate.opsForZSet().remove(sessionsKey, oldest.toArray());
    }

    private String buildRefreshKey(long memberId, String sessionId) {
        return buildKey("auth", "refreshToken", memberId + ":" + sessionId);
    }

    private String buildSessionsKey(long memberId) {
        return buildKey("auth", "refreshSessions", String.valueOf(memberId));
    }

    private String buildBlacklistKey(String tokenId) {
        return buildKey("auth", "accessTokenBlacklist", tokenId);
    }

    private String buildKey(String domain, String type, String id) {
        return redisProperties.normalizedKeyPrefix() + ":" + domain + ":" + type + ":" + id;
    }
}

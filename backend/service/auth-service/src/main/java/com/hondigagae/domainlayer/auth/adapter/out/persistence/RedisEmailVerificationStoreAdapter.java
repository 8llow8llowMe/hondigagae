package com.hondigagae.domainlayer.auth.adapter.out.persistence;

import com.hondigagae.domainlayer.auth.application.port.out.EmailVerificationStorePort;
import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 이메일 인증코드/인증완료/쿨다운 상태를 Redis에 보관한다.
 * refresh 토큰 어댑터와 달리 Redis 장애를 삼키지 않는다 — 인증코드 저장이 실패했는데
 * 발송이 성공한 것처럼 보이면 사용자가 원인 파악을 할 수 없기 때문이다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RedisEmailVerificationStoreAdapter implements EmailVerificationStorePort {

    private static final String VERIFIED_VALUE = "verified";
    private static final String COOLDOWN_VALUE = "cooldown";

    private final RedisTemplate<String, String> redisTemplate;
    private final RedisProperties redisProperties;

    @Override
    public void saveCode(String email, String code, Duration ttl) {
        redisTemplate.opsForValue().set(buildCodeKey(email), code, ttl);
    }

    @Override
    public Optional<String> findCode(String email) {
        return Optional.ofNullable(redisTemplate.opsForValue().get(buildCodeKey(email)));
    }

    @Override
    public void deleteCode(String email) {
        redisTemplate.delete(buildCodeKey(email));
    }

    @Override
    public void saveVerified(String email, Duration ttl) {
        redisTemplate.opsForValue().set(buildVerifiedKey(email), VERIFIED_VALUE, ttl);
    }

    @Override
    public boolean isVerified(String email) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(buildVerifiedKey(email)));
    }

    @Override
    public void deleteVerified(String email) {
        redisTemplate.delete(buildVerifiedKey(email));
    }

    @Override
    public boolean tryAcquireCooldown(String email, Duration ttl) {
        return Boolean.TRUE.equals(
            redisTemplate.opsForValue().setIfAbsent(buildCooldownKey(email), COOLDOWN_VALUE, ttl));
    }

    @Override
    public long increaseIpSendCount(String clientIp, Duration window) {
        try {
            String key = buildKey("emailSendIp", clientIp);
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1L) {
                // 첫 발송에서만 TTL 을 걸어 고정 윈도우를 만든다 (로그인 실패 카운터와 동일한 방식).
                redisTemplate.expire(key, window);
            }
            return count == null ? 0L : count;
        } catch (DataAccessException exception) {
            // fail-open: 발송 상한은 보조 방어라 저장소 장애로 발송 자체를 막지 않는다.
            log.error("[RedisEmailVerificationStoreAdapter] IP 발송 카운터 증가 실패(fail-open 처리): error={}",
                exception.getMessage());
            return 0L;
        }
    }

    @Override
    public long increaseVerifyFailureCount(String email, Duration ttl) {
        String key = buildFailKey(email);
        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1L) {
            redisTemplate.expire(key, ttl);
        }
        return count == null ? 0L : count;
    }

    @Override
    public void clearVerifyFailures(String email) {
        redisTemplate.delete(buildFailKey(email));
    }

    private String buildFailKey(String email) {
        return buildKey("emailVerificationFail", email);
    }

    private String buildCodeKey(String email) {
        return buildKey("emailVerificationCode", email);
    }

    private String buildVerifiedKey(String email) {
        return buildKey("emailVerified", email);
    }

    private String buildCooldownKey(String email) {
        return buildKey("emailVerificationCooldown", email);
    }

    private String buildKey(String type, String email) {
        return redisProperties.normalizedKeyPrefix() + ":auth:" + type + ":" + email;
    }
}

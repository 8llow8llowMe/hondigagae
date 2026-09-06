package com.hondigagae.domainlayer.auth.adapter.out.persistence;

import com.hondigagae.domainlayer.auth.application.port.out.PasswordResetStorePort;
import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 비밀번호 재설정 상태를 Redis 에 보관한다. 키 스키마는 이메일 인증 어댑터와 동일한
 * {@code {prefix}:auth:{type}:{email}} 관례를 따르되 타입을 분리한다.
 *
 * <p>이메일 인증 어댑터와 마찬가지로 Redis 장애를 삼키지 않는다 — 코드 저장이 실패했는데
 * 발송이 성공한 것처럼 보이면 사용자가 원인 파악을 할 수 없다.
 */
@Component
@RequiredArgsConstructor
public class RedisPasswordResetStoreAdapter implements PasswordResetStorePort {

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
    public boolean tryAcquireCooldown(String email, Duration ttl) {
        return Boolean.TRUE.equals(
            redisTemplate.opsForValue().setIfAbsent(buildCooldownKey(email), COOLDOWN_VALUE, ttl));
    }

    @Override
    public long increaseVerifyFailureCount(String email, Duration ttl) {
        String key = buildFailKey(email);
        Long count = redisTemplate.opsForValue().increment(key);
        ensureCounterTtl(key, count, ttl);
        return count == null ? 0L : count;
    }

    /**
     * INCR 와 EXPIRE 는 원자적이지 않다 — 첫 증가 직후 장애가 나면 TTL 없는 카운터가 영구히 남는다.
     * count==1 이 아니어도 TTL 이 없으면(과거 유실의 흔적) 다시 걸어 자가 치유한다.
     */
    private void ensureCounterTtl(String key, Long count, Duration ttl) {
        if (count != null && count == 1L) {
            redisTemplate.expire(key, ttl);
            return;
        }
        Long remaining = redisTemplate.getExpire(key);
        if (remaining != null && remaining < 0) {
            redisTemplate.expire(key, ttl);
        }
    }

    @Override
    public void clearVerifyFailures(String email) {
        redisTemplate.delete(buildFailKey(email));
    }

    private String buildCodeKey(String email) {
        return buildKey("passwordResetCode", email);
    }

    private String buildCooldownKey(String email) {
        return buildKey("passwordResetCooldown", email);
    }

    private String buildFailKey(String email) {
        return buildKey("passwordResetFail", email);
    }

    private String buildKey(String type, String email) {
        return redisProperties.normalizedKeyPrefix() + ":auth:" + type + ":" + email;
    }
}

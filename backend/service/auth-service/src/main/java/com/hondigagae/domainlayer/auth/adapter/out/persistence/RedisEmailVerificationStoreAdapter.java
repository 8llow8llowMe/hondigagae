package com.hondigagae.domainlayer.auth.adapter.out.persistence;

import com.hondigagae.domainlayer.auth.application.port.out.EmailVerificationStorePort;
import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 이메일 인증코드/인증완료/쿨다운 상태를 Redis에 보관한다.
 * refresh 토큰 어댑터와 달리 Redis 장애를 삼키지 않는다 — 인증코드 저장이 실패했는데
 * 발송이 성공한 것처럼 보이면 사용자가 원인 파악을 할 수 없기 때문이다.
 */
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

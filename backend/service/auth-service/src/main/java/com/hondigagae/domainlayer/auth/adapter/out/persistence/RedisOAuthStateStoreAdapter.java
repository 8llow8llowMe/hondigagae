package com.hondigagae.domainlayer.auth.adapter.out.persistence;

import com.hondigagae.domainlayer.auth.application.port.out.OAuthStateStorePort;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RedisOAuthStateStoreAdapter implements OAuthStateStorePort {

    private final RedisTemplate<String, String> redisTemplate;
    private final RedisProperties redisProperties;

    @Override
    public void save(String state, OAuthProvider provider, Duration ttl) {
        redisTemplate.opsForValue().set(buildKey(state), provider.name(), ttl);
    }

    @Override
    public Optional<OAuthProvider> consume(String state) {
        // GETDEL(Redis 6.2+)로 조회와 삭제를 원자적으로 수행해 state 재사용을 차단한다.
        String providerName = redisTemplate.opsForValue().getAndDelete(buildKey(state));
        if (providerName == null) {
            return Optional.empty();
        }

        try {
            return Optional.of(OAuthProvider.valueOf(providerName));
        } catch (IllegalArgumentException e) {
            // enum 상수명 변경 배포와 기존 state의 TTL이 겹치는 경우 — 무효 state로 처리한다.
            log.warn("[RedisOAuthStateStoreAdapter] 알 수 없는 provider 값: value={}", providerName);
            return Optional.empty();
        }
    }

    private String buildKey(String state) {
        return redisProperties.normalizedKeyPrefix() + ":auth:oauthState:" + state;
    }
}

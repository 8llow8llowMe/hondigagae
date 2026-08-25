package com.hondigagae.domainlayer.auth.adapter.out.persistence;

import com.hondigagae.domainlayer.auth.application.port.out.OAuthStateStorePort;
import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RedisOAuthStateStoreAdapter implements OAuthStateStorePort {

    private static final String STATE_VALUE = "kakao";

    private final RedisTemplate<String, String> redisTemplate;
    private final RedisProperties redisProperties;

    @Override
    public void save(String state, Duration ttl) {
        redisTemplate.opsForValue().set(buildKey(state), STATE_VALUE, ttl);
    }

    @Override
    public boolean consume(String state) {
        // GETDEL(Redis 6.2+)로 조회와 삭제를 원자적으로 수행해 state 재사용을 차단한다.
        return redisTemplate.opsForValue().getAndDelete(buildKey(state)) != null;
    }

    private String buildKey(String state) {
        return redisProperties.normalizedKeyPrefix() + ":auth:oauthState:" + state;
    }
}

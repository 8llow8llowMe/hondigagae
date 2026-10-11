package com.hondigagae.domainlayer.insight.adapter.out.cache;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

/** 장소 추천 예열 작업 잠금 (#1388). */
class RedisPlaceRecommendationPrewarmLockAdapterTest {

    private static final String KEY = "hondi:insight:recommendation:prewarm:lock";
    private static final Duration TTL = Duration.ofMinutes(5);

    private final StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
    @SuppressWarnings("unchecked")
    private final ValueOperations<String, String> valueOperations = mock(ValueOperations.class);
    private final RedisProperties redisProperties = mock(RedisProperties.class);
    private final RedisPlaceRecommendationPrewarmLockAdapter adapter = new RedisPlaceRecommendationPrewarmLockAdapter(redisTemplate, redisProperties);

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(redisProperties.normalizedKeyPrefix()).thenReturn("hondi");
    }

    @Test
    @DisplayName("SET NX 가 성공하면 잡는다 — 키는 접두사 아래 한 개, TTL 은 받은 그대로")
    void acquires() {
        when(valueOperations.setIfAbsent(eq(KEY), anyString(), eq(TTL))).thenReturn(true);

        assertThat(adapter.tryAcquire(TTL)).isTrue();
    }

    @Test
    @DisplayName("이미 누가 잡았으면 못 잡는다")
    void heldElsewhere() {
        when(valueOperations.setIfAbsent(eq(KEY), anyString(), eq(TTL))).thenReturn(false);

        assertThat(adapter.tryAcquire(TTL)).isFalse();
    }

    @Test
    @DisplayName("Redis 장애는 예외로 올리지 않고 못 잡은 것으로 본다")
    void redisDownIsNotAcquired() {
        when(valueOperations.setIfAbsent(eq(KEY), anyString(), eq(TTL))).thenThrow(new RedisConnectionFailureException("down"));

        assertThat(adapter.tryAcquire(TTL)).isFalse();
    }
}

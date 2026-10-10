package com.hondigagae.domainlayer.auth.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisTemplate;

/**
 * 남은 TTL 읽기가 Redis 의 특수값과 장애를 <b>빈 값</b>으로 접는지 고정한다 (#1293).
 * 빈 값이면 호출부가 설정값으로 대신한다 — 여기서 예외가 새면 이미 확정된 429 가 500 이 된다.
 */
class RedisRemainingTtlReaderTest {

    private static final String KEY = "hondigagae:auth:loginLock:user@example.com";

    @SuppressWarnings("unchecked")
    private final RedisTemplate<String, String> redisTemplate = mock(RedisTemplate.class);

    @Test
    @DisplayName("남은 TTL 을 밀리초 정밀도로 돌려준다")
    void readsRemainingMillis() {
        when(redisTemplate.getExpire(KEY, TimeUnit.MILLISECONDS)).thenReturn(42_300L);

        assertThat(RedisRemainingTtlReader.read(redisTemplate, KEY, "loginLock")).contains(Duration.ofMillis(42_300));
    }

    @Test
    @DisplayName("키 없음(-2) · TTL 없음(-1) · null 은 빈 값이다")
    void foldsRedisSentinelsToEmpty() {
        when(redisTemplate.getExpire(KEY, TimeUnit.MILLISECONDS)).thenReturn(-2L, -1L, null, 0L);

        assertThat(RedisRemainingTtlReader.read(redisTemplate, KEY, "loginLock")).isEmpty();
        assertThat(RedisRemainingTtlReader.read(redisTemplate, KEY, "loginLock")).isEmpty();
        assertThat(RedisRemainingTtlReader.read(redisTemplate, KEY, "loginLock")).isEmpty();
        assertThat(RedisRemainingTtlReader.read(redisTemplate, KEY, "loginLock")).isEmpty();
    }

    @Test
    @DisplayName("Redis 장애는 삼키고 빈 값이다")
    void swallowsRedisFailure() {
        when(redisTemplate.getExpire(KEY, TimeUnit.MILLISECONDS)).thenThrow(new RedisConnectionFailureException("down"));

        assertThat(RedisRemainingTtlReader.read(redisTemplate, KEY, "loginLock")).isEmpty();
    }
}

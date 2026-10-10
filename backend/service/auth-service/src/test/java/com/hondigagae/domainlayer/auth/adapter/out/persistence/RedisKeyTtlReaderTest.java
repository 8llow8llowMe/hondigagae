package com.hondigagae.domainlayer.auth.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisTemplate;

/**
 * {@code Retry-After} 용 남은 TTL 읽기의 경계값을 고정한다 (#1293). 비어 있으면 Processor 가 설정값으로 대체하므로,
 * 여기서 지켜야 할 것은 "음수 · null · 장애를 값으로 착각하지 않는다"와 "장애가 위로 새지 않는다" 두 가지다.
 */
class RedisKeyTtlReaderTest {

    private static final String KEY = "hondigagae:auth:emailVerificationCooldown:user@example.com";

    @SuppressWarnings("unchecked")
    private final RedisTemplate<String, String> redisTemplate = mock(RedisTemplate.class);

    @Test
    @DisplayName("남은 PTTL 을 밀리초 그대로 돌려준다 — 초 변환(올림)은 웹 계층 몫이다")
    void returnsRemainingMillis() {
        when(redisTemplate.getExpire(KEY, TimeUnit.MILLISECONDS)).thenReturn(41_200L);

        assertThat(RedisKeyTtlReader.readRemaining(redisTemplate, KEY)).contains(Duration.ofMillis(41_200));
    }

    @Test
    @DisplayName("키가 없으면(-2) 비운다")
    void missingKeyIsEmpty() {
        when(redisTemplate.getExpire(KEY, TimeUnit.MILLISECONDS)).thenReturn(-2L);

        assertThat(RedisKeyTtlReader.readRemaining(redisTemplate, KEY)).isEqualTo(Optional.empty());
    }

    @Test
    @DisplayName("만료가 없는 키(-1)는 비운다")
    void persistentKeyIsEmpty() {
        when(redisTemplate.getExpire(KEY, TimeUnit.MILLISECONDS)).thenReturn(-1L);

        assertThat(RedisKeyTtlReader.readRemaining(redisTemplate, KEY)).isEqualTo(Optional.empty());
    }

    @Test
    @DisplayName("null(파이프라인/트랜잭션) 응답은 비운다")
    void nullIsEmpty() {
        when(redisTemplate.getExpire(KEY, TimeUnit.MILLISECONDS)).thenReturn(null);

        assertThat(RedisKeyTtlReader.readRemaining(redisTemplate, KEY)).isEqualTo(Optional.empty());
    }

    @Test
    @DisplayName("Redis 장애는 예외 대신 비운다 — 429 가 500 으로 바뀌면 안 된다")
    void storeFailureIsEmpty() {
        when(redisTemplate.getExpire(KEY, TimeUnit.MILLISECONDS)).thenThrow(new RedisConnectionFailureException("down"));

        assertThat(RedisKeyTtlReader.readRemaining(redisTemplate, KEY)).isEqualTo(Optional.empty());
    }
}

package com.hondigagae.domainlayer.auth.application.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RetryAfterResolverTest {

    private static final Duration FALLBACK = Duration.ofSeconds(60);

    @Test
    @DisplayName("남은 TTL 을 초 올림한다")
    void ceilsRemaining() {
        assertThat(RetryAfterResolver.resolveSeconds(Optional.of(Duration.ofMillis(42_001)), FALLBACK)).isEqualTo(43L);
        assertThat(RetryAfterResolver.resolveSeconds(Optional.of(Duration.ofSeconds(42)), FALLBACK)).isEqualTo(42L);
    }

    @Test
    @DisplayName("남은 TTL 이 없거나 0 이하면 설정값으로 대신한다")
    void fallsBackWhenUnreadable() {
        assertThat(RetryAfterResolver.resolveSeconds(Optional.empty(), FALLBACK)).isEqualTo(60L);
        assertThat(RetryAfterResolver.resolveSeconds(Optional.of(Duration.ZERO), FALLBACK)).isEqualTo(60L);
        assertThat(RetryAfterResolver.resolveSeconds(Optional.of(Duration.ofSeconds(-1)), FALLBACK)).isEqualTo(60L);
    }

    @Test
    @DisplayName("최소 1초로 올린다 — 0 은 '지금 바로 재시도' 로 읽힌다")
    void atLeastOneSecond() {
        assertThat(RetryAfterResolver.resolveSeconds(Optional.of(Duration.ofMillis(1)), FALLBACK)).isEqualTo(1L);
        assertThat(RetryAfterResolver.resolveSeconds(Optional.empty(), Duration.ZERO)).isEqualTo(1L);
    }
}

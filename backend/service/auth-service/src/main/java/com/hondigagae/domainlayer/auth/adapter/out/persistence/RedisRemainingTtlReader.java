package com.hondigagae.domainlayer.auth.adapter.out.persistence;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.RedisTemplate;

/**
 * 제한 키(쿨다운 · 잠금 · IP 윈도우)의 남은 TTL 을 읽는다. 429 {@code Retry-After} 계산 전용이다 (#1293).
 *
 * <p>밀리초({@code PTTL})로 읽는다 — 초({@code TTL})는 내림이라 0.9초 남은 키가 0 으로 읽혀 "만료됨" 과
 * 구분되지 않는다. 초 올림은 호출부(application)가 한다.
 *
 * <p><b>장애를 삼킨다.</b> 이 값은 이미 거부가 확정된 응답의 안내용이라, 읽기 실패로 429 가 500 이 되면
 * 안 된다. 키 없음({@code -2}) · TTL 없음({@code -1}) · 장애는 모두 빈 값이고, 대체값은 호출부가 정한다.
 * 로그에 키를 남기지 않는다 — 키에 이메일 원문이 들어 있다.
 */
@Slf4j
final class RedisRemainingTtlReader {

    private RedisRemainingTtlReader() {
    }

    static Optional<Duration> read(RedisTemplate<String, String> redisTemplate, String key, String keyType) {
        try {
            Long remainingMillis = redisTemplate.getExpire(key, TimeUnit.MILLISECONDS);
            if (remainingMillis == null || remainingMillis <= 0) {
                return Optional.empty();
            }
            return Optional.of(Duration.ofMillis(remainingMillis));
        } catch (DataAccessException exception) {
            log.warn("[RedisRemainingTtlReader] remaining ttl lookup failed, fallback applies: keyType={}, error={}",
                keyType, exception.getMessage());
            return Optional.empty();
        }
    }
}

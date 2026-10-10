package com.hondigagae.domainlayer.auth.adapter.out.persistence;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.RedisTemplate;

/**
 * 쿨다운 · 잠금 · IP 윈도우 키의 남은 TTL 을 읽는다 ({@code Retry-After} 용, #1293).
 *
 * <p><b>읽지 못하면 비운다 — 예외를 던지지 않는다.</b> 이 값은 이미 결정된 429 응답에 헤더를 채우는 보조
 * 정보다. 여기서 Redis 장애가 위로 새면 429 가 500 으로 바뀌어 클라이언트가 재시도 시점은커녕 거부 사유조차
 * 잃는다. 비어 있으면 호출부(Processor)가 설정값으로 대체한다.
 *
 * <ul>
 *   <li>PTTL(밀리초)로 읽는다 — 초 단위 TTL 은 반올림이라 남은 0.4초가 0 으로 읽힌다. 초 변환(올림)은 웹 계층 몫이다.</li>
 *   <li>{@code -2}(키 없음) · {@code -1}(만료 없음) · {@code null}(파이프라인/트랜잭션) · {@code 0} 은 모두 비운다.</li>
 * </ul>
 */
@Slf4j
final class RedisKeyTtlReader {

    private RedisKeyTtlReader() {
    }

    static Optional<Duration> readRemaining(RedisTemplate<String, String> redisTemplate, String key) {
        try {
            Long remainingMillis = redisTemplate.getExpire(key, TimeUnit.MILLISECONDS);
            if (remainingMillis == null || remainingMillis <= 0) {
                return Optional.empty();
            }
            return Optional.of(Duration.ofMillis(remainingMillis));
        } catch (DataAccessException exception) {
            log.warn("[RedisKeyTtlReader] 남은 TTL 조회 실패(설정값으로 대체): error={}", exception.getMessage());
            return Optional.empty();
        }
    }
}

package com.hondigagae.domainlayer.auth.application.service.support;

import java.time.Duration;
import java.util.Optional;

/**
 * 429 응답의 {@code Retry-After}(정수 초) 값을 정한다 (#1293).
 *
 * <p>값은 제한을 건 Redis 키의 <b>남은 TTL</b> 이다. 저장소가 남은 TTL 을 주지 못하면(키 없음 · TTL 없음 ·
 * 장애 — 포트가 빈 값으로 돌려준다) 그 제한의 <b>설정값</b>으로 대신한다. 실제 남은 시간보다 길게 말할
 * 수는 있어도 짧게 말하지는 않는 방향이라, 클라이언트가 그 시간 뒤에 재시도하면 같은 429 를 다시 받지 않는다.
 *
 * <p>초 단위로 올림하고 최소 1초로 올린다 — {@code Retry-After: 0} 은 "지금 바로 재시도" 로 읽혀 즉시
 * 같은 429 를 부른다.
 */
public final class RetryAfterResolver {

    private static final long MIN_SECONDS = 1L;

    private RetryAfterResolver() {
    }

    public static long resolveSeconds(Optional<Duration> remaining, Duration fallback) {
        Duration source = remaining
            .filter(duration -> !duration.isNegative() && !duration.isZero())
            .orElse(fallback);
        return Math.max(MIN_SECONDS, ceilSeconds(source));
    }

    private static long ceilSeconds(Duration duration) {
        long seconds = duration.getSeconds();
        return duration.getNano() > 0 ? seconds + 1 : seconds;
    }
}

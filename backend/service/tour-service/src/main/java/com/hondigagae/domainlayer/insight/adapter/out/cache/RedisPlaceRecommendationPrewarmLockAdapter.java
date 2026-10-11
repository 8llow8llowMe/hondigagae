package com.hondigagae.domainlayer.insight.adapter.out.cache;

import com.hondigagae.domainlayer.insight.application.port.out.PlaceRecommendationPrewarmLockPort;
import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 장소 추천 예열 작업 잠금 (Redis {@code SET NX EX}, #1388).
 *
 * <p>{@link RedisForecastRefreshLockAdapter} 와 같은 방식이고, Redlock 을 쓰지 않는 이유도 같다(Sentinel 은 마스터 하나).
 * 다른 점은 <b>해제가 없다</b>는 것이다 — 회차마다 한 번이면 되므로 TTL 이 풀 때까지 잡아 둔다. 그래서 토큰도 필요 없고,
 * 값에는 디버깅용으로 잡은 시각만 남긴다.
 *
 * <p>Redis 장애는 예외로 올리지 않고 못 잡은 것으로 다룬다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RedisPlaceRecommendationPrewarmLockAdapter implements PlaceRecommendationPrewarmLockPort {

    // 결과 캐시 키({prefix}:insight:recommendation:{yyyy-MM-dd}:...)와 같은 네임스페이스지만, 날짜 자리에 prewarm 이 와서 겹치지 않는다.
    private static final String KEY_FORMAT = "%s:insight:recommendation:prewarm:lock";

    private final StringRedisTemplate stringRedisTemplate;
    private final RedisProperties redisProperties;

    @Override
    public boolean tryAcquire(Duration ttl) {
        try {
            Boolean acquired = stringRedisTemplate.opsForValue().setIfAbsent(buildKey(), Instant.now().toString(), ttl);
            return Boolean.TRUE.equals(acquired);
        } catch (RedisConnectionFailureException exception) {
            log.warn("Recommendation prewarm lock skipped, redis unavailable");
            return false;
        } catch (Exception exception) {
            log.warn("Recommendation prewarm lock failed reason={}", exception.getMessage());
            return false;
        }
    }

    private String buildKey() {
        return String.format(KEY_FORMAT, redisProperties.normalizedKeyPrefix());
    }
}

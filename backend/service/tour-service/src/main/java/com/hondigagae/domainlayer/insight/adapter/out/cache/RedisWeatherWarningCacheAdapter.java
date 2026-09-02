package com.hondigagae.domainlayer.insight.adapter.out.cache;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.insight.application.port.out.WeatherWarningCachePort;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 기상특보 캐시 (Redis).
 *
 * <p>예보 캐시와 같은 방식이다 - {@code StringRedisTemplate} + 서비스 ObjectMapper 로 JSON
 * 문자열을 직접 다룬다 (redis-core 기본 ObjectMapper 는 java.time 을 직렬화하지 못한다).
 *
 * <p><b>Redis 장애는 캐시 미스로 취급한다.</b> 캐시가 죽었다고 특보 조회가 멎으면 안 된다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RedisWeatherWarningCacheAdapter implements WeatherWarningCachePort {

    private static final String KEY_FORMAT = "%s:insight:weather:warning:%s";

    private final StringRedisTemplate stringRedisTemplate;
    private final RedisProperties redisProperties;
    private final ObjectMapper objectMapper;

    @Override
    public Optional<List<WeatherWarning>> find(String stationId) {
        try {
            String json = stringRedisTemplate.opsForValue().get(buildKey(stationId));
            if (json == null) {
                return Optional.empty();
            }
            // 빈 목록도 유효한 캐시 값이다("특보 없음"). 여기서 empty 로 접으면 안 된다.
            return Optional.of(objectMapper.readValue(json, new TypeReference<List<WeatherWarning>>() {
            }));
        } catch (RedisConnectionFailureException exception) {
            log.warn("Weather warning cache read skipped, redis unavailable stationId={}", stationId);
            return Optional.empty();
        } catch (Exception exception) {
            log.warn("Weather warning cache entry unreadable stationId={} reason={}", stationId, exception.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public void put(String stationId, List<WeatherWarning> warnings, Duration ttl) {
        try {
            stringRedisTemplate.opsForValue()
                .set(buildKey(stationId), objectMapper.writeValueAsString(warnings), ttl);
        } catch (RedisConnectionFailureException exception) {
            log.warn("Weather warning cache write skipped, redis unavailable stationId={}", stationId);
        } catch (Exception exception) {
            log.warn("Weather warning cache write failed stationId={} reason={}", stationId, exception.getMessage());
        }
    }

    private String buildKey(String stationId) {
        return KEY_FORMAT.formatted(redisProperties.normalizedKeyPrefix(), stationId);
    }
}

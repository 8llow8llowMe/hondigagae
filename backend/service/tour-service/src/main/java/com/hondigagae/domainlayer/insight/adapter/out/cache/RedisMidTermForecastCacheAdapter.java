package com.hondigagae.domainlayer.insight.adapter.out.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.insight.application.port.out.MidTermForecastCachePort;
import com.hondigagae.domainlayer.insight.application.port.out.query.CachedMidTermQueryResult;
import com.hondigagae.domainlayer.insight.domain.enums.MidTermRegion;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 예보구역별 중기예보 캐시 (Redis).
 *
 * <p>단기예보 캐시({@link RedisWeatherForecastCacheAdapter})와 같은 방식이다 -
 * {@code StringRedisTemplate} + 서비스 ObjectMapper 로 JSON 문자열을 직접 다루고,
 * Redis 장애는 예외로 올리지 않고 캐시 미스로 취급한다.
 *
 * <p>키 공간을 나눠 두는 이유는 저장하는 값의 모양이 다르기 때문이다. 단기예보는 시각별
 * {@code WeatherForecast} 목록이고 중기예보는 일자별 {@code DailyWeather} 목록이다.
 * 한 키 공간을 쓰면 스키마가 섞인다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RedisMidTermForecastCacheAdapter implements MidTermForecastCachePort {

    private static final String KEY_FORMAT = "%s:insight:weather:midterm:%s";

    private final StringRedisTemplate stringRedisTemplate;
    private final RedisProperties redisProperties;
    private final ObjectMapper objectMapper;

    @Override
    public Optional<CachedMidTermQueryResult> find(MidTermRegion region) {
        try {
            String json = stringRedisTemplate.opsForValue().get(buildKey(region));
            if (json == null) {
                return Optional.empty();
            }
            CachedMidTermEnvelope envelope = objectMapper.readValue(json, CachedMidTermEnvelope.class);
            if (envelope.dailies() == null || envelope.dailies().isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(CachedMidTermQueryResult.builder()
                .dailies(envelope.dailies())
                .freshUntil(envelope.freshUntil())
                .stale(envelope.freshUntil() == null || LocalDateTime.now().isAfter(envelope.freshUntil()))
                .build());
        } catch (RedisConnectionFailureException exception) {
            log.warn("Mid-term cache read skipped, redis unavailable region={}", region.cacheKey());
            return Optional.empty();
        } catch (Exception exception) {
            log.warn("Mid-term cache entry unreadable region={} reason={}", region.cacheKey(), exception.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public void put(
        MidTermRegion region, List<DailyWeather> dailies, LocalDateTime freshUntil, Duration retention
    ) {
        if (dailies == null || dailies.isEmpty()) {
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(new CachedMidTermEnvelope(dailies, freshUntil));
            stringRedisTemplate.opsForValue().set(buildKey(region), json, retention);
        } catch (RedisConnectionFailureException exception) {
            log.warn("Mid-term cache write skipped, redis unavailable region={}", region.cacheKey());
        } catch (Exception exception) {
            log.warn("Mid-term cache write failed region={} reason={}", region.cacheKey(), exception.getMessage());
        }
    }

    private String buildKey(MidTermRegion region) {
        return KEY_FORMAT.formatted(redisProperties.normalizedKeyPrefix(), region.cacheKey());
    }

    /** 저장 포맷. 직렬화 왕복을 테스트로 고정하기 위해 package-private 이다. */
    record CachedMidTermEnvelope(List<DailyWeather> dailies, LocalDateTime freshUntil) {

    }
}

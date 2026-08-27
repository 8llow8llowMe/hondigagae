package com.hondigagae.domainlayer.insight.adapter.out.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.common.geo.KmaGridPoint;
import com.hondigagae.domainlayer.insight.application.port.out.WeatherForecastCachePort;
import com.hondigagae.domainlayer.insight.application.port.out.query.CachedWeatherQueryResult;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
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
 * 격자별 예보 캐시 (Redis).
 *
 * <p>redis-core 의 {@code RedisTemplate} 기본 ObjectMapper 는 java.time 을 직렬화하지 못하므로
 * {@code StringRedisTemplate} + 서비스 ObjectMapper 로 JSON 문자열을 직접 다룬다
 * (ai-service 의 {@code RedisAiPlanJobStoreAdapter} 와 같은 방식).
 *
 * <p><b>캐시가 죽어도 기능은 죽지 않는다.</b> Redis 장애는 예외로 올리지 않고 캐시 미스로
 * 취급한다. 캐시는 쿼터를 아끼는 장치이지 데이터의 원천이 아니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RedisWeatherForecastCacheAdapter implements WeatherForecastCachePort {

    private static final String KEY_FORMAT = "%s:insight:weather:forecast:%s";

    private final StringRedisTemplate stringRedisTemplate;
    private final RedisProperties redisProperties;
    private final ObjectMapper objectMapper;

    @Override
    public Optional<CachedWeatherQueryResult> find(KmaGridPoint grid) {
        try {
            String json = stringRedisTemplate.opsForValue().get(buildKey(grid));
            if (json == null) {
                return Optional.empty();
            }
            CachedWeatherEnvelope envelope = objectMapper.readValue(json, CachedWeatherEnvelope.class);
            if (envelope.forecasts() == null || envelope.forecasts().isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(CachedWeatherQueryResult.builder()
                .forecasts(envelope.forecasts())
                .freshUntil(envelope.freshUntil())
                .stale(envelope.freshUntil() == null || LocalDateTime.now().isAfter(envelope.freshUntil()))
                .build());
        } catch (RedisConnectionFailureException exception) {
            log.warn("Weather cache read skipped, redis unavailable grid={}", grid.cacheKey());
            return Optional.empty();
        } catch (Exception exception) {
            // 스키마가 바뀌어 역직렬화가 깨지면 캐시 미스로 보고 원천에서 다시 받는다.
            log.warn("Weather cache entry unreadable grid={} reason={}", grid.cacheKey(), exception.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public void put(KmaGridPoint grid, List<WeatherForecast> forecasts, LocalDateTime freshUntil, Duration retention) {
        if (forecasts == null || forecasts.isEmpty()) {
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(new CachedWeatherEnvelope(forecasts, freshUntil));
            stringRedisTemplate.opsForValue().set(buildKey(grid), json, retention);
        } catch (RedisConnectionFailureException exception) {
            log.warn("Weather cache write skipped, redis unavailable grid={}", grid.cacheKey());
        } catch (Exception exception) {
            log.warn("Weather cache write failed grid={} reason={}", grid.cacheKey(), exception.getMessage());
        }
    }

    private String buildKey(KmaGridPoint grid) {
        return KEY_FORMAT.formatted(redisProperties.normalizedKeyPrefix(), grid.cacheKey());
    }

    /**
     * 저장 포맷. 신선도 판정을 위해 다음 발표 시각을 값과 함께 넣는다.
     *
     * <p>{@code private} 이 아니라 package-private 인 이유는 직렬화 왕복을 테스트로 고정하기
     * 위해서다. 이 경로가 조용히 깨지면 예외가 아니라 <b>영구 캐시 미스</b>가 되어, 기능은
     * 동작하는 채로 공공 API 쿼터만 태운다 - 로그를 보기 전까지 아무도 모른다.
     */
    record CachedWeatherEnvelope(List<WeatherForecast> forecasts, LocalDateTime freshUntil) {

    }
}

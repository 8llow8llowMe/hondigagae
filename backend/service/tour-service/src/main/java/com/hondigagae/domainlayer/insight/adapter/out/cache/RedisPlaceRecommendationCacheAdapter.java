package com.hondigagae.domainlayer.insight.adapter.out.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.insight.application.model.PlaceRecommendationCacheKey;
import com.hondigagae.domainlayer.insight.application.port.out.PlaceRecommendationCachePort;
import com.hondigagae.domainlayer.insight.application.port.out.query.CachedPlaceRecommendationQueryResult;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.redis.properties.RedisProperties;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 장소 추천 결과 캐시 (Redis, #1368).
 *
 * <p>다른 insight 캐시와 같은 방식이다 — {@code StringRedisTemplate} + 서비스 ObjectMapper 로 JSON 문자열을 직접 다룬다
 * (redis-core 기본 ObjectMapper 는 java.time 을 직렬화하지 못한다).
 *
 * <p><b>Redis 장애와 읽기 실패는 캐시 미스로 취급한다.</b> 캐시가 죽었다고 추천이 멎으면 안 된다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RedisPlaceRecommendationCacheAdapter implements PlaceRecommendationCachePort {

    private static final String KEY_FORMAT = "%s:insight:recommendation:%s:%s:%s:%s:%d";
    private static final String ABSENT = "-";
    private static final DateTimeFormatter WARNING_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmm");

    private final StringRedisTemplate stringRedisTemplate;
    private final RedisProperties redisProperties;
    private final ObjectMapper objectMapper;

    @Override
    public Optional<CachedPlaceRecommendationQueryResult> find(PlaceRecommendationCacheKey cacheKey) {
        String key = buildKey(cacheKey);
        try {
            String json = stringRedisTemplate.opsForValue().get(key);
            if (json == null) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(json, CachedPlaceRecommendationQueryResult.class));
        } catch (RedisConnectionFailureException exception) {
            log.warn("Place recommendation cache read skipped, redis unavailable key={}", key);
            return Optional.empty();
        } catch (Exception exception) {
            log.warn("Place recommendation cache entry unreadable key={} reason={}", key, exception.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public void put(PlaceRecommendationCacheKey cacheKey, CachedPlaceRecommendationQueryResult result, Duration ttl) {
        String key = buildKey(cacheKey);
        try {
            stringRedisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(result), ttl);
        } catch (RedisConnectionFailureException exception) {
            log.warn("Place recommendation cache write skipped, redis unavailable key={}", key);
        } catch (Exception exception) {
            log.warn("Place recommendation cache write failed key={} reason={}", key, exception.getMessage());
        }
    }

    /**
     * {@code {prefix}:insight:recommendation:{날짜}:{오늘 여부}:{특보}:{반려견 조건}:{개수}}.
     *
     * <p>오늘 여부를 따로 두는 이유: 23:58 에 "내일" 로 계산한 결과는 특보도 "오늘" 문구도 없는데, 자정을 넘기면 같은 날짜가
     * 오늘이 된다. 특보를 키에 담는 이유: 특보가 바뀌면 다른 키가 되어, 결과가 특보 캐시(특보 조회 자체의 TTL)보다 낡지 않는다.
     */
    String buildKey(PlaceRecommendationCacheKey cacheKey) {
        return KEY_FORMAT.formatted(redisProperties.normalizedKeyPrefix(), cacheKey.targetDate(),
            cacheKey.today() ? "today" : "other", warningKey(cacheKey.warning()), petKey(cacheKey.petCondition()), cacheKey.limit());
    }

    /** 특보를 키 한 조각으로. 판정과 응답에 쓰는 단계 · 종류 · 발효 시각을 담는다. 없으면 {@code none}. */
    static String warningKey(WeatherWarning warning) {
        if (warning == null) {
            return "none";
        }
        return String.join("-",
            nameOrAbsent(warning.level()),
            nameOrAbsent(warning.type()),
            warning.effectiveAt() == null ? ABSENT : warning.effectiveAt().format(WARNING_TIME_FORMAT));
    }

    /**
     * 반려견 조건을 키 한 조각으로 접는다. 판정에 들어가는 값 전부를 고정된 순서로 담는다 — 하나라도 빠지면 다른 조건의
     * 결과를 돌려준다. 빈 견종은 없음과 같다({@code PetCondition.isSpecified} 와 같은 규칙).
     *
     * <p>견종은 점수를 움직이지 않지만 <b>근거 문구에 그대로 들어간다</b>(크기 제한 근거의 {@code PetCondition.subject()},
     * 예: "소형견만 가능 조건이라 퍼그(중형견)는 …"). 그래서 "지정 여부" 가 아니라 값 자체를 담는다 — 지정 여부만 담으면
     * 시츄로 물었는데 퍼그라고 적힌 근거를 돌려준다. 문구에 들어가는 그대로(공백 포함) 담고, URL 인코딩해 키 구분자(:)와 섞이지 않게 한다.
     */
    static String petKey(PetCondition pet) {
        if (pet == null) {
            pet = PetCondition.unspecified();
        }
        String breed = pet.breed() == null || pet.breed().isBlank()
            ? ABSENT
            : URLEncoder.encode(pet.breed(), StandardCharsets.UTF_8);
        return String.join(",",
            "size=" + nameOrAbsent(pet.sizeType()),
            "act=" + nameOrAbsent(pet.activityLevel()),
            "soc=" + nameOrAbsent(pet.sociality()),
            "heat=" + flag(pet.heatSensitive()),
            "cold=" + flag(pet.coldSensitive()),
            "noise=" + flag(pet.noiseSensitive()),
            "breed=" + breed);
    }

    private static String nameOrAbsent(Enum<?> value) {
        return value == null ? ABSENT : value.name();
    }

    private static String flag(boolean value) {
        return value ? "1" : "0";
    }
}

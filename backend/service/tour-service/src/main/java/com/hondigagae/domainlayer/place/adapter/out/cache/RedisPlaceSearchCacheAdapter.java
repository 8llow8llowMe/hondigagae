package com.hondigagae.domainlayer.place.adapter.out.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.place.application.info.NearbyPlaceInfo;
import com.hondigagae.domainlayer.place.application.info.NearbyPlacesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummariesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummaryInfo;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.PlaceSearchCachePort;
import com.hondigagae.redis.properties.RedisProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 키워드 검색 결과 캐시 (Redis).
 *
 * <p>날씨 캐시와 같은 방식이다 — {@code StringRedisTemplate} + 서비스 ObjectMapper,
 * Redis 장애는 예외로 올리지 않고 캐시 미스로 취급한다. 장소 원천은 batch 적재라
 * 즉시 무효화 대신 TTL 로 갈아탄다.
 */
@Slf4j
@Component
public class RedisPlaceSearchCacheAdapter implements PlaceSearchCachePort {

    private static final String LIST_KEY_FORMAT = "%s:tour:place:list:%s";
    private static final String NEARBY_KEY_FORMAT = "%s:tour:place:nearby:%s";

    private final StringRedisTemplate stringRedisTemplate;
    private final RedisProperties redisProperties;
    private final ObjectMapper objectMapper;
    private final Duration ttl;

    public RedisPlaceSearchCacheAdapter(
        StringRedisTemplate stringRedisTemplate,
        RedisProperties redisProperties,
        ObjectMapper objectMapper,
        @Value("${place.search-cache-seconds:300}") long searchCacheSeconds
    ) {
        this.stringRedisTemplate = stringRedisTemplate;
        this.redisProperties = redisProperties;
        this.objectMapper = objectMapper;
        this.ttl = Duration.ofSeconds(searchCacheSeconds);
    }

    @Override
    public Optional<PlaceSummariesInfo> findList(PlaceSearchCriteria criteria) {
        return read(listKey(criteria), CachedPlaceListEnvelope.class)
            .map(envelope -> new PlaceSummariesInfo(envelope.places(), envelope.hasNext()));
    }

    @Override
    public void putList(PlaceSearchCriteria criteria, PlaceSummariesInfo info) {
        write(listKey(criteria), new CachedPlaceListEnvelope(info.places(), info.hasNext()));
    }

    @Override
    public Optional<NearbyPlacesInfo> findNearby(NearbyPlaceCriteria criteria) {
        return read(nearbyKey(criteria), CachedNearbyEnvelope.class)
            .map(envelope -> new NearbyPlacesInfo(envelope.places(), envelope.totalCount()));
    }

    @Override
    public void putNearby(NearbyPlaceCriteria criteria, NearbyPlacesInfo info) {
        write(nearbyKey(criteria), new CachedNearbyEnvelope(info.places(), info.totalCount()));
    }

    private <T> Optional<T> read(String key, Class<T> type) {
        try {
            String json = stringRedisTemplate.opsForValue().get(key);
            if (json == null) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(json, type));
        } catch (RedisConnectionFailureException exception) {
            log.warn("Place search cache read skipped, redis unavailable key={}", key);
            return Optional.empty();
        } catch (Exception exception) {
            log.warn("Place search cache entry unreadable key={} reason={}", key, exception.getMessage());
            return Optional.empty();
        }
    }

    private void write(String key, Object envelope) {
        try {
            String json = objectMapper.writeValueAsString(envelope);
            stringRedisTemplate.opsForValue().set(key, json, ttl);
        } catch (RedisConnectionFailureException exception) {
            log.warn("Place search cache write skipped, redis unavailable key={}", key);
        } catch (Exception exception) {
            log.warn("Place search cache write failed key={} reason={}", key, exception.getMessage());
        }
    }

    private String listKey(PlaceSearchCriteria criteria) {
        String canonical = String.join("|",
            part(criteria.areaCode()),
            part(criteria.sigunguCode()),
            part(criteria.contentType()),
            part(criteria.petAllowanceType()),
            part(criteria.indoor()),
            part(criteria.allowedPetSize()),
            part(criteria.petSizeType()),
            part(criteria.petWeightKg()),
            part(criteria.sourceCategory()),
            part(criteria.keyword()),
            part(criteria.lastPlaceId()),
            String.valueOf(criteria.size()));
        return LIST_KEY_FORMAT.formatted(redisProperties.normalizedKeyPrefix(), sha256(canonical));
    }

    private String nearbyKey(NearbyPlaceCriteria criteria) {
        String canonical = String.join("|",
            String.valueOf(criteria.lat()),
            String.valueOf(criteria.lng()),
            String.valueOf(criteria.radius()),
            part(criteria.contentType()),
            part(criteria.petAllowanceType()),
            part(criteria.indoor()),
            part(criteria.allowedPetSize()),
            part(criteria.petSizeType()),
            part(criteria.petWeightKg()),
            part(criteria.sourceCategory()),
            part(criteria.keyword()),
            String.valueOf(criteria.size()));
        return NEARBY_KEY_FORMAT.formatted(redisProperties.normalizedKeyPrefix(), sha256(canonical));
    }

    private static String part(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static String sha256(String canonical) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    /**
     * 저장 포맷. package-private 인 이유는 직렬화 왕복을 테스트로 고정하기 위해서다.
     * 이 경로가 깨져도 예외가 아니라 영구 캐시 미스가 된다.
     */
    record CachedPlaceListEnvelope(List<PlaceSummaryInfo> places, boolean hasNext) {

    }

    record CachedNearbyEnvelope(List<NearbyPlaceInfo> places, int totalCount) {

    }
}

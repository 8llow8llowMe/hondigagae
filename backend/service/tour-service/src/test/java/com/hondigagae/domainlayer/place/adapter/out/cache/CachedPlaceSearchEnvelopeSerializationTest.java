package com.hondigagae.domainlayer.place.adapter.out.cache;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.place.adapter.out.cache.RedisPlaceSearchCacheAdapter.CachedNearbyEnvelope;
import com.hondigagae.domainlayer.place.adapter.out.cache.RedisPlaceSearchCacheAdapter.CachedPlaceListEnvelope;
import com.hondigagae.domainlayer.place.application.info.NearbyPlaceInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummaryInfo;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/**
 * 장소 검색 캐시 포맷의 직렬화 왕복 (#421).
 *
 * <p>이 경로가 깨져도 예외가 나지 않는다. 어댑터가 역직렬화 실패를 캐시 미스로
 * 삼키기 때문이다. 대신 증상이 영구 캐시 미스가 되어 DB 만 반복한다.
 */
class CachedPlaceSearchEnvelopeSerializationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(JacksonAutoConfiguration.class));

    @Test
    @DisplayName("목록 캐시가 JSON 왕복을 거쳐도 값이 그대로 살아 있다")
    void listRoundTripsThroughJson() {
        contextRunner.run(context -> {
            ObjectMapper objectMapper = context.getBean(ObjectMapper.class);
            CachedPlaceListEnvelope original = new CachedPlaceListEnvelope(List.of(sample()), true);

            CachedPlaceListEnvelope restored = objectMapper.readValue(
                objectMapper.writeValueAsString(original), CachedPlaceListEnvelope.class);

            assertThat(restored.hasNext()).isTrue();
            assertThat(restored.places()).hasSize(1);
            PlaceSummaryInfo place = restored.places().get(0);
            assertThat(place.placeId()).isEqualTo(1L);
            assertThat(place.title()).isEqualTo("성산일출봉");
            assertThat(place.contentType()).isEqualTo(ContentType.TOURIST_SPOT);
            assertThat(place.petAllowanceType()).isEqualTo(PetAllowanceType.ALLOWED);
            assertThat(place.source()).isEqualTo(PlaceSource.TOUR_API);
            assertThat(place.lat()).isEqualByComparingTo("33.458");
        });
    }

    @Test
    @DisplayName("주변 캐시의 거리와 총계도 뜻을 잃지 않는다")
    void nearbyKeepsDistanceAndTotal() {
        contextRunner.run(context -> {
            ObjectMapper objectMapper = context.getBean(ObjectMapper.class);
            CachedNearbyEnvelope original = new CachedNearbyEnvelope(
                List.of(NearbyPlaceInfo.builder().place(sample()).distanceMeters(120).build()), 4);

            CachedNearbyEnvelope restored = objectMapper.readValue(
                objectMapper.writeValueAsString(original), CachedNearbyEnvelope.class);

            assertThat(restored.totalCount()).isEqualTo(4);
            assertThat(restored.places().get(0).distanceMeters()).isEqualTo(120);
            assertThat(restored.places().get(0).place().title()).isEqualTo("성산일출봉");
        });
    }

    private static PlaceSummaryInfo sample() {
        return PlaceSummaryInfo.builder()
            .placeId(1L)
            .contentType(ContentType.TOURIST_SPOT)
            .title("성산일출봉")
            .addr1("제주특별자치도 서귀포시 성산읍")
            .lat(new BigDecimal("33.458"))
            .lng(new BigDecimal("126.942"))
            .petAllowanceType(PetAllowanceType.ALLOWED)
            .allowedPetSize(AllowedPetSize.ALL)
            .source(PlaceSource.TOUR_API)
            .build();
    }
}

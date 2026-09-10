package com.hondigagae.domainlayer.place.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.application.info.NearbyPlacesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummariesInfo;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.PlaceRepositoryPort;
import com.hondigagae.domainlayer.place.application.port.out.PlaceSearchCachePort;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceImageQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceIntroQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlacePetInfoQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSliceQueryResult;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import com.hondigagae.domainlayer.place.domain.model.Place;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 주변 장소의 {@code totalCount} 도 총계인가 (이슈 #285).
 *
 * <p>긴급 시설과 <b>같은 함정을 같은 모양으로</b> 밟고 있었다 - 프로세서가 {@code size} 로
 * 자른 목록만 넘기고 프리젠터가 그 목록을 다시 세어 총계라고 내렸다. 한쪽만 고치면 다음 사람이
 * 다른 쪽에서 같은 것을 다시 발견하게 되므로 둘을 함께 고정한다.
 */
class PlaceQueryProcessorNearbyTest {

    private static final double LAT = 33.4996d;
    private static final double LNG = 126.5312d;

    @Test
    @DisplayName("size 로 잘려도 totalCount 는 반경 안 전체 개수다")
    void totalCountIsNotTruncatedBySize() {
        NearbyPlacesInfo info = processorWith(placesNear(30)).getNearbyPlaces(criteria(15));

        assertThat(info.places()).hasSize(15);
        // 회귀 방지의 핵심. 예전에는 이 값이 15 였다.
        assertThat(info.totalCount()).isEqualTo(30);
    }

    @Test
    @DisplayName("반경 밖 장소는 totalCount 에도 들어가지 않는다")
    void totalCountCountsOnlyPlacesInsideRadius() {
        // 사각 범위 질의는 원의 모서리 밖까지 준다. 총계는 반경 필터를 통과한 것만 세야 한다.
        List<Place> mixed = Stream.concat(
            placesNear(4).stream(),
            Stream.of(place(900L, LAT + 0.5d, LNG))).toList();

        NearbyPlacesInfo info = processorWith(mixed).getNearbyPlaces(criteria(50));

        assertThat(info.places()).hasSize(4);
        assertThat(info.totalCount()).isEqualTo(4);
    }

    // --- 픽스처 ---------------------------------------------------------------

    private static NearbyPlaceCriteria criteria(int size) {
        return NearbyPlaceCriteria.builder()
            .lat(LAT)
            .lng(LNG)
            .radius(5_000)
            .size(size)
            .build();
    }

    /** 반경 5km 안에 촘촘히 놓인 장소들. 위도 0.001도가 약 111m 다. */
    private static List<Place> placesNear(int count) {
        return IntStream.range(0, count)
            .mapToObj(i -> place(i + 1L, LAT + i * 0.001d, LNG))
            .toList();
    }

    private static Place place(long id, double lat, double lng) {
        return Place.builder()
            .id(id)
            .source(PlaceSource.CULTURE_PORTAL)
            .sourceKey("culture-" + id)
            .sourceCategory("카페")
            .contentTypeId("39")
            .title("장소 " + id)
            .addr1("제주특별자치도 제주시")
            .lat(BigDecimal.valueOf(lat))
            .lng(BigDecimal.valueOf(lng))
            .petAvailable(true)
            .petAllowanceType(PetAllowanceType.ALLOWED)
            .indoor(true)
            .build();
    }

    private static PlaceQueryProcessor processorWith(List<Place> places) {
        return new PlaceQueryProcessor(new PlaceRepositoryPort() {
            @Override
            public List<Place> findNearby(NearbyPlaceCriteria criteria) {
                // 실제 어댑터와 같이 사각 범위 전량을 돌려준다 - DB 에서 자르지 않는다.
                return places;
            }

            @Override
            public PlaceSliceQueryResult findPlaces(PlaceSearchCriteria criteria) {
                throw new UnsupportedOperationException();
            }

            @Override
            public List<Long> findVisibleIds(Collection<Long> placeIds) {
                return List.of();
            }

            @Override
            public List<Place> findVisiblePlaces(Collection<Long> placeIds) {
                return List.of();
            }

            @Override
            public Optional<Place> findPlaceById(long placeId) {
                return Optional.empty();
            }

            @Override
            public Optional<PlaceIntroQueryResult> findIntroByPlaceId(long placeId) {
                return Optional.empty();
            }

            @Override
            public Optional<PlacePetInfoQueryResult> findPetInfoByPlaceId(long placeId) {
                return Optional.empty();
            }

            @Override
            public List<PlaceImageQueryResult> findImagesByPlaceId(long placeId) {
                return List.of();
            }
        }, missCache());
    }

    private static PlaceSearchCachePort missCache() {
        return new PlaceSearchCachePort() {
            @Override
            public Optional<PlaceSummariesInfo> findList(PlaceSearchCriteria criteria) {
                return Optional.empty();
            }

            @Override
            public void putList(PlaceSearchCriteria criteria, PlaceSummariesInfo info) {
            }

            @Override
            public Optional<NearbyPlacesInfo> findNearby(NearbyPlaceCriteria criteria) {
                return Optional.empty();
            }

            @Override
            public void putNearby(NearbyPlaceCriteria criteria, NearbyPlacesInfo info) {
            }
        };
    }
}

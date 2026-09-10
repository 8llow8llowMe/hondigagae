package com.hondigagae.domainlayer.place.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.application.info.NearbyPlacesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummariesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummaryInfo;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.PlaceRepositoryPort;
import com.hondigagae.domainlayer.place.application.port.out.PlaceSearchCachePort;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceImageQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceIntroQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlacePetInfoQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSliceQueryResult;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import com.hondigagae.domainlayer.place.domain.model.Place;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PlaceQueryProcessorKeywordCacheTest {

    @Test
    @DisplayName("키워드가 있으면 캐시 히트 시 DB 를 다시 치지 않는다")
    void keywordHitSkipsRepository() {
        AtomicInteger dbCalls = new AtomicInteger();
        RecordingCache cache = new RecordingCache();
        cache.listHit = new PlaceSummariesInfo(List.of(summary(1L, "성산일출봉")), false);

        PlaceQueryProcessor processor = new PlaceQueryProcessor(countingRepo(dbCalls), cache);
        PlaceSummariesInfo info = processor.getPlaces(PlaceSearchCriteria.builder()
            .keyword("  성산  ")
            .size(20)
            .build());

        assertThat(info.places()).extracting(PlaceSummaryInfo::title).containsExactly("성산일출봉");
        assertThat(dbCalls).hasValue(0);
        assertThat(cache.listLookups).containsExactly("성산");
    }

    @Test
    @DisplayName("키워드 미스면 DB 결과를 캐시에 넣는다")
    void keywordMissStoresResult() {
        AtomicInteger dbCalls = new AtomicInteger();
        RecordingCache cache = new RecordingCache();
        PlaceQueryProcessor processor = new PlaceQueryProcessor(
            placesRepo(dbCalls, List.of(place(1L, "성산일출봉"))), cache);

        PlaceSummariesInfo info = processor.getPlaces(PlaceSearchCriteria.builder()
            .keyword("성산")
            .size(20)
            .build());

        assertThat(info.places()).hasSize(1);
        assertThat(dbCalls).hasValue(1);
        assertThat(cache.storedLists).hasSize(1);
        assertThat(cache.storedLists.get(0).keyword()).isEqualTo("성산");
    }

    @Test
    @DisplayName("키워드가 없으면 캐시를 읽지도 쓰지도 않는다")
    void noKeywordSkipsCache() {
        AtomicInteger dbCalls = new AtomicInteger();
        RecordingCache cache = new RecordingCache();
        PlaceQueryProcessor processor = new PlaceQueryProcessor(
            placesRepo(dbCalls, List.of(place(1L, "천지연폭포"))), cache);

        processor.getPlaces(PlaceSearchCriteria.builder().size(20).build());

        assertThat(dbCalls).hasValue(1);
        assertThat(cache.listLookups).isEmpty();
        assertThat(cache.storedLists).isEmpty();
    }

    private static Place place(long id, String title) {
        return Place.builder()
            .id(id)
            .source(PlaceSource.TOUR_API)
            .sourceKey("key-" + id)
            .contentTypeId("12")
            .title(title)
            .addr1("제주특별자치도 서귀포시")
            .lat(BigDecimal.valueOf(33.24))
            .lng(BigDecimal.valueOf(126.55))
            .petAvailable(true)
            .petAllowanceType(PetAllowanceType.ALLOWED)
            .build();
    }

    private static PlaceSummaryInfo summary(long id, String title) {
        return PlaceSummaryInfo.builder()
            .placeId(id)
            .contentType(ContentType.TOURIST_SPOT)
            .title(title)
            .build();
    }

    private static PlaceRepositoryPort placesRepo(AtomicInteger dbCalls, List<Place> places) {
        return new EmptyPlaceRepositoryPort() {
            @Override
            public PlaceSliceQueryResult findPlaces(PlaceSearchCriteria criteria) {
                dbCalls.incrementAndGet();
                return new PlaceSliceQueryResult(places, false);
            }
        };
    }

    private static PlaceRepositoryPort countingRepo(AtomicInteger dbCalls) {
        return new EmptyPlaceRepositoryPort() {
            @Override
            public PlaceSliceQueryResult findPlaces(PlaceSearchCriteria criteria) {
                dbCalls.incrementAndGet();
                return new PlaceSliceQueryResult(List.of(), false);
            }
        };
    }

    private static final class RecordingCache implements PlaceSearchCachePort {
        private final List<String> listLookups = new ArrayList<>();
        private final List<PlaceSearchCriteria> storedLists = new ArrayList<>();
        private PlaceSummariesInfo listHit;

        @Override
        public Optional<PlaceSummariesInfo> findList(PlaceSearchCriteria criteria) {
            listLookups.add(criteria.keyword());
            return Optional.ofNullable(listHit);
        }

        @Override
        public void putList(PlaceSearchCriteria criteria, PlaceSummariesInfo info) {
            storedLists.add(criteria);
        }

        @Override
        public Optional<NearbyPlacesInfo> findNearby(NearbyPlaceCriteria criteria) {
            return Optional.empty();
        }

        @Override
        public void putNearby(NearbyPlaceCriteria criteria, NearbyPlacesInfo info) {
        }
    }

    private abstract static class EmptyPlaceRepositoryPort implements PlaceRepositoryPort {
        @Override
        public PlaceSliceQueryResult findPlaces(PlaceSearchCriteria criteria) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<Place> findNearby(NearbyPlaceCriteria criteria) {
            return List.of();
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
    }
}

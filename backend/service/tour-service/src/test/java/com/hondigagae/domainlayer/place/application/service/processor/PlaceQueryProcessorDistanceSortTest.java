package com.hondigagae.domainlayer.place.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.place.application.exception.PlaceErrorCode;
import com.hondigagae.domainlayer.place.application.exception.PlaceException;
import com.hondigagae.domainlayer.place.application.info.NearbyPlacesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummariesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummaryInfo;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.PlaceRepositoryPort;
import com.hondigagae.domainlayer.place.application.port.out.PlaceSearchCachePort;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceCoordinateQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceImageQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceIntroQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlacePetInfoQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSitemapEntryQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSliceQueryResult;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import com.hondigagae.domainlayer.place.domain.model.Place;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 장소 목록 거리순 (#1202).
 *
 * <p>고정하는 것은 셋이다. <b>순서</b> — (반올림 거리 m, placeId) 오름차순이고 응답 distanceMeters 가 그 키다.
 * <b>이어 붙이기</b> — 커서가 lastPlaceId 하나라도 같은 반올림 거리의 동률에서 중복·누락이 없어야 한다.
 * <b>하위 호환</b> — 좌표가 없으면 거리 포트를 부르지 않고 예전 id 순 경로를 그대로 탄다(ai-service 후보 조회).
 */
class PlaceQueryProcessorDistanceSortTest {

    /** 중문 부근. */
    private static final double ORIGIN_LAT = 33.2541d;
    private static final double ORIGIN_LNG = 126.4129d;
    /** 위도 0.001도가 약 111m 다. */
    private static final double STEP = 0.001d;

    @Test
    @DisplayName("기준 좌표가 있으면 가까운 순이고, 같은 반올림 거리는 placeId 오름차순이다")
    void sortsByRoundedDistanceThenPlaceId() {
        FakePort port = new FakePort()
            .visible(30L, ORIGIN_LAT + 3 * STEP, ORIGIN_LNG)
            .visible(20L, ORIGIN_LAT + STEP, ORIGIN_LNG)
            // 북쪽과 남쪽으로 같은 폭이면 거리가 정확히 같다 — 동률을 placeId 로 가른다
            .visible(12L, ORIGIN_LAT - 2 * STEP, ORIGIN_LNG)
            .visible(11L, ORIGIN_LAT + 2 * STEP, ORIGIN_LNG);

        PlaceSummariesInfo info = processor(port).getPlaces(distanceCriteria(20).build());

        assertThat(info.places()).extracting(PlaceSummaryInfo::placeId).containsExactly(20L, 11L, 12L, 30L);
        assertThat(info.places().get(1).distanceMeters()).isEqualTo(info.places().get(2).distanceMeters());
        assertThat(info.hasNext()).isFalse();
    }

    @Test
    @DisplayName("distanceMeters 는 정렬에 쓴 반올림 거리(m)다")
    void distanceMetersIsTheSortKey() {
        FakePort port = new FakePort().visible(1L, ORIGIN_LAT + STEP, ORIGIN_LNG);

        PlaceSummaryInfo only = processor(port).getPlaces(distanceCriteria(20).build()).places().get(0);

        int expected = (int) Math.round(GeoDistance.meters(ORIGIN_LAT, ORIGIN_LNG, ORIGIN_LAT + STEP, ORIGIN_LNG));
        assertThat(only.distanceMeters()).isEqualTo(expected).isBetween(110, 112);
    }

    @Test
    @DisplayName("페이지를 이어 붙이면 동률이 많아도 중복·누락 없이 한 번에 받은 순서와 같다")
    void pagesConcatenateWithoutDuplicatesOrGaps() {
        FakePort port = new FakePort();
        long id = 100L;
        // 7개 고리 x 4방향 = 28곳. 같은 고리의 네 곳은 반올림 거리가 같아 동률 덩어리가 된다.
        for (int ring = 1; ring <= 7; ring++) {
            port.visible(id++, ORIGIN_LAT + ring * STEP, ORIGIN_LNG)
                .visible(id++, ORIGIN_LAT - ring * STEP, ORIGIN_LNG)
                .visible(id++, ORIGIN_LAT + ring * STEP, ORIGIN_LNG + STEP)
                .visible(id++, ORIGIN_LAT - ring * STEP, ORIGIN_LNG + STEP);
        }
        PlaceQueryProcessor processor = processor(port);
        List<Long> all = processor.getPlaces(distanceCriteria(50).build()).places().stream()
            .map(PlaceSummaryInfo::placeId).toList();

        List<Long> concatenated = new ArrayList<>();
        Long cursor = null;
        int pages = 0;
        while (true) {
            PlaceSummariesInfo page = processor.getPlaces(distanceCriteria(5).lastPlaceId(cursor).build());
            page.places().forEach(place -> concatenated.add(place.placeId()));
            pages++;
            if (!page.hasNext()) {
                break;
            }
            assertThat(page.places()).hasSize(5);
            cursor = page.places().get(page.places().size() - 1).placeId();
        }

        assertThat(all).hasSize(28);
        assertThat(concatenated).containsExactlyElementsOf(all);
        assertThat(new HashSet<>(concatenated)).hasSize(28);
        assertThat(pages).isEqualTo(6);
    }

    @Test
    @DisplayName("남은 항목이 정확히 size 개면 hasNext 는 false 다")
    void hasNextIsFalseWhenRemainderEqualsSize() {
        FakePort port = new FakePort()
            .visible(1L, ORIGIN_LAT + STEP, ORIGIN_LNG)
            .visible(2L, ORIGIN_LAT + 2 * STEP, ORIGIN_LNG)
            .visible(3L, ORIGIN_LAT + 3 * STEP, ORIGIN_LNG);
        PlaceQueryProcessor processor = processor(port);

        assertThat(processor.getPlaces(distanceCriteria(3).build()).hasNext()).isFalse();
        assertThat(processor.getPlaces(distanceCriteria(2).build()).hasNext()).isTrue();
    }

    @Test
    @DisplayName("커서 장소가 그사이 목록에서 빠져도(병합·delisted) 그 좌표로 다음 페이지가 이어진다")
    void cursorContinuesEvenWhenCursorPlaceIsHidden() {
        FakePort port = new FakePort()
            .visible(1L, ORIGIN_LAT + STEP, ORIGIN_LNG)
            .visible(2L, ORIGIN_LAT + 2 * STEP, ORIGIN_LNG)
            .visible(3L, ORIGIN_LAT + 3 * STEP, ORIGIN_LNG);
        PlaceQueryProcessor processor = processor(port);
        PlaceSummariesInfo first = processor.getPlaces(distanceCriteria(2).build());
        assertThat(first.places()).extracting(PlaceSummaryInfo::placeId).containsExactly(1L, 2L);

        // 첫 페이지의 마지막 장소가 병합으로 숨겨졌다. 좌표 행은 남아 있다.
        port.hide(2L);
        PlaceSummariesInfo second = processor.getPlaces(distanceCriteria(2).lastPlaceId(2L).build());

        assertThat(second.places()).extracting(PlaceSummaryInfo::placeId).containsExactly(3L);
        assertThat(second.hasNext()).isFalse();
    }

    @Test
    @DisplayName("커서 장소를 찾을 수 없거나 좌표가 없으면 PLACE_110 으로 거절한다")
    void unknownCursorIsRejected() {
        FakePort port = new FakePort().visible(1L, ORIGIN_LAT + STEP, ORIGIN_LNG);

        assertThatThrownBy(() -> processor(port).getPlaces(distanceCriteria(20).lastPlaceId(999L).build()))
            .isInstanceOfSatisfying(PlaceException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(PlaceErrorCode.DISTANCE_CURSOR_INVALID));
        // 커서부터 확인한다 — 잘못된 커서로 후보 전량을 읽은 뒤에 거절하지 않는다
        assertThat(port.coordinateCalls).isZero();
        assertThat(port.visiblePlaceLookups).isZero();
    }

    @Test
    @DisplayName("IN 조회가 순서를 섞어 돌려줘도 응답은 거리 순서를 지킨다")
    void keepsDistanceOrderRegardlessOfLookupOrder() {
        FakePort port = new FakePort()
            .visible(5L, ORIGIN_LAT + 5 * STEP, ORIGIN_LNG)
            .visible(9L, ORIGIN_LAT + STEP, ORIGIN_LNG)
            .visible(7L, ORIGIN_LAT + 3 * STEP, ORIGIN_LNG);
        port.shuffleLookup = true;

        PlaceSummariesInfo info = processor(port).getPlaces(distanceCriteria(20).build());

        assertThat(info.places()).extracting(PlaceSummaryInfo::placeId).containsExactly(9L, 7L, 5L);
    }

    @Test
    @DisplayName("후보를 고른 뒤 엔티티를 읽기 전에 숨겨진 장소는 조용히 빠진다")
    void placeHiddenBetweenQueriesIsSkipped() {
        FakePort port = new FakePort()
            .visible(1L, ORIGIN_LAT + STEP, ORIGIN_LNG)
            .visible(2L, ORIGIN_LAT + 2 * STEP, ORIGIN_LNG);
        port.vanishOnLookup.add(1L);

        PlaceSummariesInfo info = processor(port).getPlaces(distanceCriteria(20).build());

        assertThat(info.places()).extracting(PlaceSummaryInfo::placeId).containsExactly(2L);
    }

    @Test
    @DisplayName("기준 좌표가 없으면 거리 포트를 부르지 않고 예전 id 순 경로를 탄다 — distanceMeters 는 null")
    void withoutOriginUsesIdOrderPathUntouched() {
        FakePort port = new FakePort().visible(1L, ORIGIN_LAT + STEP, ORIGIN_LNG);

        PlaceSummariesInfo info = processor(port).getPlaces(PlaceSearchCriteria.builder()
            .areaCode("39").sigunguCode("3").petAllowanceType(PetAllowanceType.ALLOWED).size(50).build());

        assertThat(port.idOrderCalls).isEqualTo(1);
        assertThat(port.coordinateCalls).isZero();
        assertThat(port.cursorLookups).isZero();
        assertThat(info.places()).extracting(PlaceSummaryInfo::distanceMeters).containsOnlyNulls();
    }

    @Test
    @DisplayName("거리순에서는 id 순 목록 포트를 부르지 않는다")
    void distancePathDoesNotUseIdOrderPort() {
        FakePort port = new FakePort().visible(1L, ORIGIN_LAT + STEP, ORIGIN_LNG);

        processor(port).getPlaces(distanceCriteria(20).build());

        assertThat(port.idOrderCalls).isZero();
        assertThat(port.coordinateCalls).isEqualTo(1);
    }

    @Test
    @DisplayName("lat 과 lng 중 하나만 있으면 조건 자체를 만들 수 없다 — PLACE_109")
    void halfOriginIsRejected() {
        assertThatThrownBy(() -> PlaceSearchCriteria.builder().lat(ORIGIN_LAT).size(20).build())
            .isInstanceOfSatisfying(PlaceException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(PlaceErrorCode.COORDINATE_PAIR_REQUIRED));
        assertThatThrownBy(() -> PlaceSearchCriteria.builder().lng(ORIGIN_LNG).size(20).build())
            .isInstanceOfSatisfying(PlaceException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(PlaceErrorCode.COORDINATE_PAIR_REQUIRED));
    }

    @Test
    @DisplayName("키워드 거리순도 캐시 미스면 결과를 넣고, 히트면 포트를 다시 치지 않는다")
    void keywordDistanceListGoesThroughCache() {
        FakePort port = new FakePort().visible(1L, ORIGIN_LAT + STEP, ORIGIN_LNG);
        MemoryCache cache = new MemoryCache();
        PlaceQueryProcessor processor = new PlaceQueryProcessor(port, cache);
        PlaceSearchCriteria criteria = distanceCriteria(20).keyword(" 중문  ").build();

        PlaceSummariesInfo miss = processor.getPlaces(criteria);
        PlaceSummariesInfo hit = processor.getPlaces(criteria);

        assertThat(cache.stored).hasSize(1);
        PlaceSearchCriteria storedKey = cache.stored.keySet().iterator().next();
        assertThat(storedKey.keyword()).isEqualTo("중문");
        assertThat(storedKey.lat()).isEqualTo(ORIGIN_LAT);
        assertThat(storedKey.lng()).isEqualTo(ORIGIN_LNG);
        assertThat(port.coordinateCalls).isEqualTo(1);
        assertThat(hit).isEqualTo(miss);
        assertThat(hit.places().get(0).distanceMeters()).isNotNull();
    }

    // --- 픽스처 ---------------------------------------------------------------

    private static PlaceSearchCriteria.PlaceSearchCriteriaBuilder distanceCriteria(int size) {
        return PlaceSearchCriteria.builder().lat(ORIGIN_LAT).lng(ORIGIN_LNG).size(size);
    }

    private static PlaceQueryProcessor processor(FakePort port) {
        return new PlaceQueryProcessor(port, new MemoryCache());
    }

    private static Place place(long id, double lat, double lng) {
        return Place.builder()
            .id(id)
            .source(PlaceSource.TOUR_API)
            .sourceKey("key-" + id)
            .contentTypeId("39")
            .title("장소 " + id)
            .addr1("제주특별자치도 서귀포시")
            .lat(BigDecimal.valueOf(lat))
            .lng(BigDecimal.valueOf(lng))
            .petAvailable(true)
            .petAllowanceType(PetAllowanceType.ALLOWED)
            .build();
    }

    /**
     * 실제 어댑터의 계약을 흉내 낸다 — 후보 좌표는 노출 행만, 커서 좌표는 노출 여부와 무관하게,
     * 엔티티는 노출 행만 준다.
     */
    private static final class FakePort implements PlaceRepositoryPort {

        private final Map<Long, Place> rows = new LinkedHashMap<>();
        private final Set<Long> hidden = new HashSet<>();
        private final Set<Long> vanishOnLookup = new HashSet<>();
        private boolean shuffleLookup;
        private int idOrderCalls;
        private int coordinateCalls;
        private int cursorLookups;
        private int visiblePlaceLookups;

        FakePort visible(long id, double lat, double lng) {
            rows.put(id, place(id, lat, lng));
            return this;
        }

        void hide(long id) {
            hidden.add(id);
        }

        private boolean isVisible(long id) {
            return !hidden.contains(id);
        }

        @Override
        public PlaceSliceQueryResult findPlaces(PlaceSearchCriteria criteria) {
            idOrderCalls++;
            List<Place> places = rows.values().stream()
                .filter(place -> isVisible(place.id()))
                .sorted(Comparator.comparingLong(Place::id))
                .toList();
            return new PlaceSliceQueryResult(places, false);
        }

        @Override
        public List<PlaceCoordinateQueryResult> findCoordinates(PlaceSearchCriteria criteria) {
            coordinateCalls++;
            return rows.values().stream()
                .filter(place -> isVisible(place.id()))
                .map(place -> new PlaceCoordinateQueryResult(place.id(), place.lat(), place.lng()))
                .toList();
        }

        @Override
        public Optional<PlaceCoordinateQueryResult> findCoordinateById(long placeId) {
            cursorLookups++;
            return Optional.ofNullable(rows.get(placeId))
                .map(place -> new PlaceCoordinateQueryResult(place.id(), place.lat(), place.lng()));
        }

        @Override
        public List<Place> findVisiblePlaces(Collection<Long> placeIds) {
            visiblePlaceLookups++;
            List<Place> found = placeIds.stream()
                .filter(rows::containsKey)
                .filter(this::isVisible)
                .filter(id -> !vanishOnLookup.contains(id))
                .map(rows::get)
                .toList();
            if (!shuffleLookup) {
                return found;
            }
            // IN 조회는 순서를 보장하지 않는다 — 일부러 거꾸로 준다
            List<Place> reversed = new ArrayList<>(found);
            Collections.reverse(reversed);
            return reversed;
        }

        @Override
        public List<Place> findNearby(NearbyPlaceCriteria criteria) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<Long> findVisibleIds(Collection<Long> placeIds) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<PlaceSitemapEntryQueryResult> findSitemapEntries() {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<Place> findPlaceById(long placeId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<PlaceIntroQueryResult> findIntroByPlaceId(long placeId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<PlacePetInfoQueryResult> findPetInfoByPlaceId(long placeId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<PlaceImageQueryResult> findImagesByPlaceId(long placeId) {
            throw new UnsupportedOperationException();
        }
    }

    /** 키워드가 있을 때만 쓰인다. 키는 정규화된 조건 그대로다. */
    private static final class MemoryCache implements PlaceSearchCachePort {

        private final Map<PlaceSearchCriteria, PlaceSummariesInfo> stored = new LinkedHashMap<>();

        @Override
        public Optional<PlaceSummariesInfo> findList(PlaceSearchCriteria criteria) {
            return Optional.ofNullable(stored.get(criteria));
        }

        @Override
        public void putList(PlaceSearchCriteria criteria, PlaceSummariesInfo info) {
            stored.put(criteria, info);
        }

        @Override
        public Optional<NearbyPlacesInfo> findNearby(NearbyPlaceCriteria criteria) {
            return Optional.empty();
        }

        @Override
        public void putNearby(NearbyPlaceCriteria criteria, NearbyPlacesInfo info) {
        }
    }
}

package com.hondigagae.domainlayer.place.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.application.info.NearbyPlacesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSitemapEntryInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummariesInfo;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.PlaceRepositoryPort;
import com.hondigagae.domainlayer.place.application.port.out.PlaceSearchCachePort;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceImageQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceIntroQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlacePetInfoQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSitemapEntryQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSliceQueryResult;
import com.hondigagae.domainlayer.place.domain.model.Place;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 사이트맵 조회는 포트가 준 순서와 값을 그대로 옮긴다 (#1135).
 *
 * <p>여기서 고정하는 것은 <b>수정일의 출처</b>다. lastmod 로 내보낼 값은 원천 수정일이고,
 * 적재 시각({@code updatedAt})은 배치가 upsert 마다 모든 행을 갱신해 뜻이 없다.
 */
class PlaceQueryProcessorSitemapTest {

    @Test
    @DisplayName("원천 수정일이 modifiedAt 으로 옮겨지고, 없으면 null 이 유지된다")
    void sourceModifiedAtBecomesModifiedAt() {
        LocalDateTime modifiedAt = LocalDateTime.of(2026, 8, 27, 14, 30, 5);
        PlaceQueryProcessor processor = processorWith(List.of(
            new PlaceSitemapEntryQueryResult(126_434L, PetAllowanceType.ALLOWED, modifiedAt),
            new PlaceSitemapEntryQueryResult(4_611_952_987_747_030_849L, PetAllowanceType.UNKNOWN, null)));

        List<PlaceSitemapEntryInfo> entries = processor.getSitemapPlaces();

        assertThat(entries).extracting(PlaceSitemapEntryInfo::placeId).containsExactly(126_434L, 4_611_952_987_747_030_849L);
        assertThat(entries).extracting(PlaceSitemapEntryInfo::petAllowanceType)
            .containsExactly(PetAllowanceType.ALLOWED, PetAllowanceType.UNKNOWN);
        assertThat(entries).extracting(PlaceSitemapEntryInfo::modifiedAt).containsExactly(modifiedAt, null);
    }

    private static PlaceQueryProcessor processorWith(List<PlaceSitemapEntryQueryResult> entries) {
        return new PlaceQueryProcessor(new PlaceRepositoryPort() {
            @Override
            public List<PlaceSitemapEntryQueryResult> findSitemapEntries() {
                return entries;
            }

            @Override
            public PlaceSliceQueryResult findPlaces(PlaceSearchCriteria criteria) {
                throw new UnsupportedOperationException();
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
            public List<Place> findVisiblePlaces(Collection<Long> placeIds) {
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
        }, unusedCache());
    }

    /** 사이트맵은 캐시를 거치지 않는다 — 부르면 실패하게 둔다. */
    private static PlaceSearchCachePort unusedCache() {
        return new PlaceSearchCachePort() {
            @Override
            public Optional<PlaceSummariesInfo> findList(PlaceSearchCriteria criteria) {
                throw new UnsupportedOperationException();
            }

            @Override
            public void putList(PlaceSearchCriteria criteria, PlaceSummariesInfo info) {
                throw new UnsupportedOperationException();
            }

            @Override
            public Optional<NearbyPlacesInfo> findNearby(NearbyPlaceCriteria criteria) {
                throw new UnsupportedOperationException();
            }

            @Override
            public void putNearby(NearbyPlaceCriteria criteria, NearbyPlacesInfo info) {
                throw new UnsupportedOperationException();
            }
        };
    }
}

package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSitemapEntryQueryResult;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import com.hondigagae.persistence.config.QuerydslConfigurer;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.test.context.TestPropertySource;

/**
 * 사이트맵용 장소 전량 조회 검증 (#1135).
 *
 * <p>QueryDSL 커스텀 구현이라 컴파일로는 아무것도 검증되지 않는다 — 노출 규칙({@code visible()})을
 * 거치는지, 3컬럼 projection 이 생성자에 맞게 묶이는지는 실제 스키마에 질의해야 드러난다.
 */
@DataJpaTest(includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
    classes = PlaceRepository.class))
@EntityScan("com.hondigagae.domainlayer")
@EnableJpaAuditing
@Import(QuerydslConfigurer.class)
@TestPropertySource(properties = {
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class PlaceRepositorySitemapTest {

    /** TourAPI 아이디 대역. 제주 실측이 12만~344만이다. */
    private static final long TOUR_API_ID_LOW = 126_434L;
    private static final long TOUR_API_ID_HIGH = 3_444_948L;
    /** 해시 아이디 대역. {@code PlaceIdFactory} 가 2^62 이상으로 접는다. */
    private static final long HASH_ID = 4_611_952_987_747_030_849L;

    @Autowired
    private PlaceRepository placeRepository;

    @Test
    @DisplayName("병합·원천에서 사라진 장소는 사이트맵에 오지 않는다 — 목록·주변과 같은 노출 규칙이다")
    void hiddenRowsAreExcluded() {
        placeRepository.save(place(TOUR_API_ID_LOW, PlaceSource.TOUR_API).build());
        placeRepository.save(place(TOUR_API_ID_LOW + 1, PlaceSource.CULTURE_PORTAL)
            .mergedIntoId(TOUR_API_ID_LOW).build());
        placeRepository.save(place(TOUR_API_ID_LOW + 2, PlaceSource.MFDS)
            .delistedAt(LocalDateTime.of(2026, 9, 1, 0, 0)).build());

        List<PlaceSitemapEntryQueryResult> entries = placeRepository.findSitemapEntries();

        assertThat(entries).extracting(PlaceSitemapEntryQueryResult::placeId).containsExactly(TOUR_API_ID_LOW);
    }

    @Test
    @DisplayName("placeId 오름차순이다 — 저장 순서와 무관하게 해시 대역이 TourAPI 대역 뒤에 온다")
    void orderedByPlaceIdAscending() {
        placeRepository.save(place(HASH_ID, PlaceSource.CULTURE_PORTAL).build());
        placeRepository.save(place(TOUR_API_ID_HIGH, PlaceSource.TOUR_API).build());
        placeRepository.save(place(TOUR_API_ID_LOW, PlaceSource.TOUR_API).build());

        List<PlaceSitemapEntryQueryResult> entries = placeRepository.findSitemapEntries();

        assertThat(entries).extracting(PlaceSitemapEntryQueryResult::placeId)
            .containsExactly(TOUR_API_ID_LOW, TOUR_API_ID_HIGH, HASH_ID);
    }

    @Test
    @DisplayName("원천 수정일은 있으면 그대로, 없으면 null 로 온다 — 적재 시각으로 메우지 않는다")
    void sourceModifiedAtPassesThroughIncludingNull() {
        LocalDateTime modifiedAt = LocalDateTime.of(2026, 8, 27, 14, 30, 5);
        placeRepository.save(place(TOUR_API_ID_LOW, PlaceSource.TOUR_API).sourceModifiedAt(modifiedAt).build());
        placeRepository.save(place(HASH_ID, PlaceSource.MFDS).sourceModifiedAt(null).build());

        List<PlaceSitemapEntryQueryResult> entries = placeRepository.findSitemapEntries();

        assertThat(entries).extracting(PlaceSitemapEntryQueryResult::sourceModifiedAt)
            .containsExactly(modifiedAt, null);
    }

    @Test
    @DisplayName("동반 구분으로 거르지 않는다 — UNKNOWN·NOT_ALLOWED 도 오고, 고르는 것은 호출한 쪽이다")
    void petAllowanceTypeIsCarriedNotFiltered() {
        placeRepository.save(place(TOUR_API_ID_LOW, PlaceSource.TOUR_API).petAllowanceType(PetAllowanceType.ALLOWED).build());
        placeRepository.save(place(TOUR_API_ID_LOW + 1, PlaceSource.TOUR_API).petAllowanceType(PetAllowanceType.UNKNOWN).build());
        placeRepository.save(place(TOUR_API_ID_LOW + 2, PlaceSource.TOUR_API).petAllowanceType(PetAllowanceType.NOT_ALLOWED).build());

        List<PlaceSitemapEntryQueryResult> entries = placeRepository.findSitemapEntries();

        assertThat(entries).extracting(PlaceSitemapEntryQueryResult::petAllowanceType)
            .containsExactly(PetAllowanceType.ALLOWED, PetAllowanceType.UNKNOWN, PetAllowanceType.NOT_ALLOWED);
    }

    @Test
    @DisplayName("노출 가능한 장소가 없으면 빈 목록이다")
    void emptyWhenNothingVisible() {
        assertThat(placeRepository.findSitemapEntries()).isEmpty();
    }

    private PlaceEntity.PlaceEntityBuilder place(long id, PlaceSource source) {
        return PlaceEntity.builder()
            .id(id)
            .source(source)
            .sourceKey("key-" + id)
            .contentTypeId("12")
            .title("장소 " + id)
            .addr1("제주특별자치도 제주시")
            .areaCode("39")
            .sigunguCode("4")
            .petAvailable(true)
            .petAllowanceType(PetAllowanceType.ALLOWED)
            .allowedPetSize(AllowedPetSize.UNKNOWN)
            .syncedAt(LocalDateTime.now());
    }
}

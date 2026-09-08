package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
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
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.test.context.TestPropertySource;

/**
 * 장소 목록의 정렬과 커서 검증 (#321).
 *
 * <p>정렬을 <b>id 오름차순</b>으로 뒤집은 것이 이 테스트의 대상이다. 아이디 대역이 원천별로
 * 갈려 있어(TourAPI = contentId 백만 단위, 나머지 = 2<sup>62</sup> 이상 해시) 오름차순이 곧
 * "사진 있는 관광정보 장소 먼저" 가 된다.
 *
 * <p>커서도 함께 본다. 정렬 방향과 커서 비교 방향은 <b>같이 움직여야</b> 하고, 한쪽만 바꾸면
 * 같은 페이지를 무한히 돌려주거나 목록이 첫 페이지에서 끝난다 — 컴파일로는 잡히지 않는다.
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
class PlaceRepositoryListOrderTest {

    /** TourAPI 아이디 대역. 제주 실측이 12만~344만이다. */
    private static final long TOUR_API_ID_LOW = 126_434L;
    private static final long TOUR_API_ID_HIGH = 3_444_948L;
    /** 해시 아이디 대역. {@code PlaceIdFactory} 가 2^62 이상으로 접는다. */
    private static final long HASH_ID_LOW = 4_611_952_987_747_030_849L;
    private static final long HASH_ID_HIGH = 6_911_654_082_648_022_785L;

    @Autowired
    private PlaceRepository placeRepository;

    @Test
    @DisplayName("첫 페이지는 사진 있는 관광정보 장소부터 온다 — id 오름차순이 곧 원천 우선순위다")
    void firstPageStartsWithTourApiRows() {
        placeRepository.save(place(HASH_ID_HIGH, PlaceSource.CULTURE_PORTAL, "테지움사파리"));
        placeRepository.save(place(HASH_ID_LOW, PlaceSource.CULTURE_PORTAL, "제주도립미술관"));
        placeRepository.save(place(TOUR_API_ID_HIGH, PlaceSource.TOUR_API, "안돌오름"));
        placeRepository.save(place(TOUR_API_ID_LOW, PlaceSource.TOUR_API, "천지연폭포"));

        Slice<PlaceEntity> firstPage = placeRepository.searchByCriteria(criteria().size(2).build());

        assertThat(firstPage.getContent()).extracting(PlaceEntity::getTitle)
            .containsExactly("천지연폭포", "안돌오름");
        assertThat(firstPage.hasNext()).isTrue();
    }

    @Test
    @DisplayName("커서는 직전 마지막 아이디 뒤에서 이어진다 — 방향이 어긋나면 같은 페이지가 반복된다")
    void cursorContinuesAfterTheLastId() {
        placeRepository.save(place(TOUR_API_ID_LOW, PlaceSource.TOUR_API, "천지연폭포"));
        placeRepository.save(place(TOUR_API_ID_HIGH, PlaceSource.TOUR_API, "안돌오름"));
        placeRepository.save(place(HASH_ID_LOW, PlaceSource.CULTURE_PORTAL, "제주도립미술관"));

        Slice<PlaceEntity> firstPage = placeRepository.searchByCriteria(criteria().size(2).build());
        long cursor = firstPage.getContent().get(firstPage.getContent().size() - 1).getId();
        Slice<PlaceEntity> secondPage = placeRepository.searchByCriteria(
            criteria().size(2).lastPlaceId(cursor).build());

        assertThat(secondPage.getContent()).extracting(PlaceEntity::getTitle)
            .containsExactly("제주도립미술관");
        assertThat(secondPage.hasNext()).isFalse();
    }

    @Test
    @DisplayName("커서로 받은 아이디 자신은 다음 페이지에 다시 나오지 않는다")
    void cursorIsExclusive() {
        placeRepository.save(place(TOUR_API_ID_LOW, PlaceSource.TOUR_API, "천지연폭포"));
        placeRepository.save(place(TOUR_API_ID_HIGH, PlaceSource.TOUR_API, "안돌오름"));

        Slice<PlaceEntity> page = placeRepository.searchByCriteria(
            criteria().size(20).lastPlaceId(TOUR_API_ID_LOW).build());

        assertThat(page.getContent()).extracting(PlaceEntity::getId)
            .containsExactly(TOUR_API_ID_HIGH);
    }

    @Test
    @DisplayName("병합·등록 철회된 장소는 목록에 오지 않는다 — 정렬을 바꿔도 노출 규칙은 그대로다")
    void hiddenRowsStayHidden() {
        placeRepository.save(place(TOUR_API_ID_LOW, PlaceSource.TOUR_API, "천지연폭포"));
        placeRepository.save(baseBuilder(TOUR_API_ID_LOW + 1, PlaceSource.CULTURE_PORTAL, "흡수된 폭포")
            .mergedIntoId(TOUR_API_ID_LOW).build());
        placeRepository.save(baseBuilder(TOUR_API_ID_LOW + 2, PlaceSource.MFDS, "등록 철회된 식당")
            .delistedAt(LocalDateTime.now()).build());

        Slice<PlaceEntity> page = placeRepository.searchByCriteria(criteria().size(20).build());

        assertThat(page.getContent()).extracting(PlaceEntity::getTitle).containsExactly("천지연폭포");
    }

    private PlaceSearchCriteria.PlaceSearchCriteriaBuilder criteria() {
        return PlaceSearchCriteria.builder().areaCode("39");
    }

    private PlaceEntity place(long id, PlaceSource source, String title) {
        return baseBuilder(id, source, title).build();
    }

    private PlaceEntity.PlaceEntityBuilder baseBuilder(long id, PlaceSource source, String title) {
        return PlaceEntity.builder()
            .id(id)
            .source(source)
            .sourceKey("key-" + id)
            .contentTypeId("12")
            .title(title)
            .addr1("제주특별자치도 제주시")
            .areaCode("39")
            .sigunguCode("4")
            .petAvailable(true)
            .petAllowanceType(PetAllowanceType.ALLOWED)
            .allowedPetSize(AllowedPetSize.UNKNOWN)
            .syncedAt(LocalDateTime.now());
    }
}

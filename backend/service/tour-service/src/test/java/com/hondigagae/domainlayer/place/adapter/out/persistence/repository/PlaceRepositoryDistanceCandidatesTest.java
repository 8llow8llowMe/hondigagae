package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceCoordinateQueryResult;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import com.hondigagae.persistence.config.QuerydslConfigurer;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
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
 * 장소 목록 거리순의 후보·커서 좌표 조회 (#1202).
 *
 * <p>후보 조회는 새 쿼리지만 <b>목록과 같은 필터</b>를 거쳐야 한다 — 노출 규칙({@code visible()})을 빠뜨리면
 * 병합·delisted 장소가 거리순에서만 살아난다. 커서 좌표는 반대로 노출 여부를 보지 않아야 페이지 사이에
 * 숨겨진 장소에서도 목록이 이어진다. 둘 다 컴파일로는 검증되지 않아 실제 스키마에 질의한다.
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
class PlaceRepositoryDistanceCandidatesTest {

    @Autowired
    private PlaceRepository placeRepository;

    @Test
    @DisplayName("후보는 노출 가능하고 좌표가 둘 다 있는 행만이다 — 병합·delisted·좌표 없음은 빠진다")
    void candidatesAreVisibleRowsWithCoordinates() {
        placeRepository.save(withCoordinates(1L, "노출 장소").build());
        placeRepository.save(withCoordinates(2L, "병합된 장소").mergedIntoId(1L).build());
        placeRepository.save(withCoordinates(3L, "등록 철회된 장소").delistedAt(LocalDateTime.now()).build());
        placeRepository.save(baseBuilder(4L, "좌표 없는 장소").build());
        placeRepository.save(baseBuilder(5L, "경도만 없는 장소").lat(new BigDecimal("33.2541")).build());

        List<PlaceCoordinateQueryResult> found = placeRepository.findCoordinatesByCriteria(criteria().build());

        assertThat(found).extracting(PlaceCoordinateQueryResult::placeId).containsExactly(1L);
        assertThat(found.get(0).lat()).isEqualByComparingTo("33.2541");
        assertThat(found.get(0).lng()).isEqualByComparingTo("126.4129");
    }

    @Test
    @DisplayName("목록의 필터(지역·시군구·콘텐츠 타입·키워드·반려견 크기)가 그대로 걸린다")
    void listFiltersApply() {
        placeRepository.save(withCoordinates(10L, "중문 흑돼지 식당").contentTypeId("39").sigunguCode("3").build());
        placeRepository.save(withCoordinates(11L, "중문 관광지").contentTypeId("12").sigunguCode("3").build());
        placeRepository.save(withCoordinates(12L, "제주시 흑돼지 식당").contentTypeId("39").sigunguCode("4").build());
        placeRepository.save(withCoordinates(13L, "중문 소형견 식당").contentTypeId("39").sigunguCode("3")
            .allowedPetSize(AllowedPetSize.SMALL_ONLY).build());
        placeRepository.save(withCoordinates(14L, "다른 지역 식당").contentTypeId("39").sigunguCode("3").areaCode("1").build());

        List<PlaceCoordinateQueryResult> found = placeRepository.findCoordinatesByCriteria(criteria()
            .sigunguCode("3").contentType(ContentType.RESTAURANT).keyword("중문 식당").petSizeType(PetSizeType.MEDIUM).build());

        assertThat(found).extracting(PlaceCoordinateQueryResult::placeId).containsExactly(10L);
    }

    @Test
    @DisplayName("후보 조회는 lastPlaceId 로 자르지 않는다 — 거리순 커서는 id 가 아니라 거리 키로 넘는다")
    void candidatesIgnoreIdCursor() {
        placeRepository.save(withCoordinates(20L, "아이디 작은 장소").build());
        placeRepository.save(withCoordinates(21L, "아이디 큰 장소").build());

        List<PlaceCoordinateQueryResult> found = placeRepository.findCoordinatesByCriteria(criteria().lastPlaceId(21L).build());

        assertThat(found).extracting(PlaceCoordinateQueryResult::placeId).containsExactlyInAnyOrder(20L, 21L);
    }

    @Test
    @DisplayName("커서 좌표는 노출 여부와 무관하게 준다 — 병합·delisted 행에서도 이어진다")
    void cursorCoordinateIgnoresVisibility() {
        placeRepository.save(withCoordinates(30L, "병합된 장소").mergedIntoId(31L).build());
        placeRepository.save(withCoordinates(32L, "등록 철회된 장소").delistedAt(LocalDateTime.now()).build());

        Optional<PlaceCoordinateQueryResult> merged = placeRepository.findCoordinateById(30L);
        Optional<PlaceCoordinateQueryResult> delisted = placeRepository.findCoordinateById(32L);

        assertThat(merged).hasValueSatisfying(result -> {
            assertThat(result.placeId()).isEqualTo(30L);
            assertThat(result.lat()).isEqualByComparingTo("33.2541");
            assertThat(result.lng()).isEqualByComparingTo("126.4129");
        });
        assertThat(delisted).isPresent();
    }

    @Test
    @DisplayName("커서 장소가 없거나 좌표가 없으면 빈 값이다")
    void cursorCoordinateIsEmptyWhenMissingOrCoordinateless() {
        placeRepository.save(baseBuilder(40L, "좌표 없는 장소").build());

        assertThat(placeRepository.findCoordinateById(40L)).isEmpty();
        assertThat(placeRepository.findCoordinateById(999L)).isEmpty();
    }

    private PlaceSearchCriteria.PlaceSearchCriteriaBuilder criteria() {
        return PlaceSearchCriteria.builder().areaCode("39").lat(33.25).lng(126.41).size(20);
    }

    private PlaceEntity.PlaceEntityBuilder withCoordinates(long id, String title) {
        return baseBuilder(id, title).lat(new BigDecimal("33.2541")).lng(new BigDecimal("126.4129"));
    }

    private PlaceEntity.PlaceEntityBuilder baseBuilder(long id, String title) {
        return PlaceEntity.builder()
            .id(id)
            .source(PlaceSource.TOUR_API)
            .sourceKey("key-" + id)
            .contentTypeId("12")
            .title(title)
            .addr1("제주특별자치도 서귀포시")
            .areaCode("39")
            .sigunguCode("3")
            .petAvailable(true)
            .petAllowanceType(PetAllowanceType.ALLOWED)
            .allowedPetSize(AllowedPetSize.UNKNOWN)
            .syncedAt(LocalDateTime.now());
    }
}

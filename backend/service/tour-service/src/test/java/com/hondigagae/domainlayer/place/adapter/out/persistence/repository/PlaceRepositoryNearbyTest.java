package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.test.context.TestPropertySource;

/**
 * 주변 장소 사각 범위 조회 검증.
 *
 * <p>JPQL 은 컴파일로 검증되지 않아 실제 스키마에 질의해 본다. 이 쿼리에서 놓치기 쉬운 두 가지를
 * 확인한다 — 병합으로 사라진 행이 빠지는지, 좌표가 없는 행이 조건에서 자연히 걸러지는지.
 */
@DataJpaTest(includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
    classes = PlaceRepository.class))
@EntityScan("com.hondigagae.domainlayer")
@EnableJpaAuditing
@TestPropertySource(properties = {
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class PlaceRepositoryNearbyTest {

    /** 제주시청 부근. 실제 적재 데이터의 좌표대와 맞춘다. */
    private static final BigDecimal MIN_LAT = new BigDecimal("33.4800");
    private static final BigDecimal MAX_LAT = new BigDecimal("33.5200");
    private static final BigDecimal MIN_LNG = new BigDecimal("126.5000");
    private static final BigDecimal MAX_LNG = new BigDecimal("126.5600");

    @Autowired
    private PlaceRepository placeRepository;

    @Test
    @DisplayName("사각 범위 안의 장소만 찾고, 병합된 행과 좌표 없는 행은 제외한다")
    void findNearbyExcludesMergedAndCoordinateless() {
        placeRepository.save(place(1L, "제주 애견동반 식당", "39", "33.5000", "126.5300", null));
        placeRepository.save(place(2L, "범위 밖 서귀포 카페", "39", "33.2500", "126.5600", null));
        // 다른 행으로 병합되어 사라진 장소
        placeRepository.save(place(3L, "중복으로 흡수된 카페", "39", "33.5010", "126.5310", 1L));
        placeRepository.save(placeWithoutCoordinate(4L, "좌표 없는 장소"));

        List<PlaceEntity> found = placeRepository.findNearby(
            MIN_LAT, MAX_LAT, MIN_LNG, MAX_LNG, null, null, null, null, null);

        assertThat(found).extracting(PlaceEntity::getTitle)
            .containsExactly("제주 애견동반 식당");
    }

    @Test
    @DisplayName("원본 분류로 거르면 같은 콘텐츠 타입 안에서 음식점과 카페가 갈린다")
    void filterBySourceCategory() {
        placeRepository.save(place(10L, "일반음식점 업소", "39", "33.5000", "126.5300", null, "일반음식점"));
        placeRepository.save(place(11L, "반려동물 카페", "39", "33.5005", "126.5305", null, "카페"));

        List<PlaceEntity> cafes = placeRepository.findNearby(
            MIN_LAT, MAX_LAT, MIN_LNG, MAX_LNG, "39", null, null, null, "카페");

        assertThat(cafes).extracting(PlaceEntity::getTitle).containsExactly("반려동물 카페");
    }

    @Test
    @DisplayName("indoor 가 null 인 장소는 indoor 필터 어느 쪽으로도 잡히지 않는다")
    void unknownIndoorIsNeitherTrueNorFalse() {
        placeRepository.save(place(20L, "실내 확인된 카페", "39", "33.5000", "126.5300", null, "카페", Boolean.TRUE));
        // 식약처 원천처럼 실내 여부를 모르는 장소
        placeRepository.save(place(21L, "실내 미상 음식점", "39", "33.5001", "126.5301", null, "일반음식점", null));

        List<PlaceEntity> indoorOnly = placeRepository.findNearby(
            MIN_LAT, MAX_LAT, MIN_LNG, MAX_LNG, null, null, Boolean.TRUE, null, null);
        List<PlaceEntity> outdoorOnly = placeRepository.findNearby(
            MIN_LAT, MAX_LAT, MIN_LNG, MAX_LNG, null, null, Boolean.FALSE, null, null);
        List<PlaceEntity> noFilter = placeRepository.findNearby(
            MIN_LAT, MAX_LAT, MIN_LNG, MAX_LNG, null, null, null, null, null);

        assertThat(indoorOnly).extracting(PlaceEntity::getTitle).containsExactly("실내 확인된 카페");
        assertThat(outdoorOnly).isEmpty();
        assertThat(noFilter).hasSize(2);
    }

    @Test
    @DisplayName("delisted 장소는 목록·주변 검색에서 빠지지만 상세 조회는 계속 응답한다")
    void delistedIsHiddenFromSearchButDetailStillWorks() {
        placeRepository.save(place(30L, "영업 중 식당", "39", "33.5000", "126.5300", null));
        PlaceEntity delisted = placeRepository.save(
            baseBuilder(31L, "등록 철회된 식당").contentTypeId("39")
                .lat(new BigDecimal("33.5005")).lng(new BigDecimal("126.5305"))
                .indoor(Boolean.TRUE)
                .delistedAt(LocalDateTime.now())
                .build());

        List<PlaceEntity> nearby = placeRepository.findNearby(
            MIN_LAT, MAX_LAT, MIN_LNG, MAX_LNG, null, null, null, null, null);
        assertThat(nearby).extracting(PlaceEntity::getTitle).containsExactly("영업 중 식당");

        // 기존 일정이 참조할 수 있어 상세는 살아 있어야 한다
        assertThat(placeRepository.findByIdAndMergedIntoIdIsNull(delisted.getId())).isPresent();
    }

    private PlaceEntity place(long id, String title, String contentTypeId,
        String lat, String lng, Long mergedIntoId) {
        return place(id, title, contentTypeId, lat, lng, mergedIntoId, null, Boolean.TRUE);
    }

    private PlaceEntity place(long id, String title, String contentTypeId,
        String lat, String lng, Long mergedIntoId, String sourceCategory) {
        return place(id, title, contentTypeId, lat, lng, mergedIntoId, sourceCategory, Boolean.TRUE);
    }

    private PlaceEntity place(long id, String title, String contentTypeId, String lat, String lng,
        Long mergedIntoId, String sourceCategory, Boolean indoor) {
        return baseBuilder(id, title)
            .contentTypeId(contentTypeId)
            .sourceCategory(sourceCategory)
            .lat(new BigDecimal(lat))
            .lng(new BigDecimal(lng))
            .indoor(indoor)
            .mergedIntoId(mergedIntoId)
            .build();
    }

    private PlaceEntity placeWithoutCoordinate(long id, String title) {
        return baseBuilder(id, title).contentTypeId("39").build();
    }

    private PlaceEntity.PlaceEntityBuilder baseBuilder(long id, String title) {
        return PlaceEntity.builder()
            .id(id)
            .source(PlaceSource.MFDS)
            .sourceKey("key-" + id)
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

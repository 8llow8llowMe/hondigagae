package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import com.hondigagae.persistence.config.QuerydslConfigurer;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
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
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.test.context.TestPropertySource;

/**
 * 주변 장소 검색(QueryDSL) 검증.
 *
 * <p>동적 조건 조립은 컴파일로 검증되지 않아 실제 스키마에 질의해 본다. 놓치기 쉬운 세 가지를
 * 확인한다 — 병합·delisted 행이 빠지는지, 좌표 없는 행이 걸러지는지, indoor 가 null 인
 * 장소가 true/false 어느 필터에도 잡히지 않는지.
 */
@DataJpaTest(includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
    classes = PlaceRepository.class))
// 슬라이스 테스트라도 리포지터리 스캔은 도메인 전체를 덮으므로 엔티티도 같은 범위로 잡아야 한다.
@EntityScan("com.hondigagae.domainlayer")
@EnableJpaAuditing
// 커스텀 구현(QueryDSL)이 JPAQueryFactory 빈을 요구한다. 슬라이스에는 없어 직접 올린다.
@Import(QuerydslConfigurer.class)
@TestPropertySource(properties = {
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class PlaceRepositoryNearbyTest {

    /** 제주시청 부근. 실제 적재 데이터의 좌표대와 맞춘다. */
    private static final double CENTER_LAT = 33.5000;
    private static final double CENTER_LNG = 126.5300;
    private static final int RADIUS_3KM = 3_000;

    @Autowired
    private PlaceRepository placeRepository;

    @Test
    @DisplayName("사각 범위 안의 장소만 찾고, 병합된 행과 좌표 없는 행은 제외한다")
    void searchNearbyExcludesMergedAndCoordinateless() {
        placeRepository.save(place(1L, "제주 애견동반 식당", "33.5000", "126.5300", null));
        placeRepository.save(place(2L, "범위 밖 서귀포 카페", "33.2500", "126.5600", null));
        // 다른 행으로 병합되어 사라진 장소
        placeRepository.save(place(3L, "중복으로 흡수된 카페", "33.5010", "126.5310", 1L));
        placeRepository.save(baseBuilder(4L, "좌표 없는 장소").contentTypeId("39").build());

        List<PlaceEntity> found = placeRepository.searchNearby(criteria().build());

        assertThat(found).extracting(PlaceEntity::getTitle).containsExactly("제주 애견동반 식당");
    }

    @Test
    @DisplayName("원본 분류로 거르면 같은 콘텐츠 타입 안에서 음식점과 카페가 갈린다")
    void filterBySourceCategory() {
        placeRepository.save(place(10L, "일반음식점 업소", "33.5000", "126.5300", null, "일반음식점"));
        placeRepository.save(place(11L, "반려동물 카페", "33.5005", "126.5305", null, "카페"));

        List<PlaceEntity> cafes = placeRepository.searchNearby(
            criteria().sourceCategory("카페").build());

        assertThat(cafes).extracting(PlaceEntity::getTitle).containsExactly("반려동물 카페");
    }

    @Test
    @DisplayName("indoor 가 null 인 장소는 indoor 필터 어느 쪽으로도 잡히지 않는다")
    void unknownIndoorIsNeitherTrueNorFalse() {
        placeRepository.save(place(20L, "실내 확인된 카페", "33.5000", "126.5300", null, "카페", Boolean.TRUE));
        // 식약처 원천처럼 실내 여부를 모르는 장소
        placeRepository.save(place(21L, "실내 미상 음식점", "33.5001", "126.5301", null, "일반음식점", null));

        List<PlaceEntity> indoorOnly = placeRepository.searchNearby(criteria().indoor(Boolean.TRUE).build());
        List<PlaceEntity> outdoorOnly = placeRepository.searchNearby(criteria().indoor(Boolean.FALSE).build());
        List<PlaceEntity> noFilter = placeRepository.searchNearby(criteria().build());

        assertThat(indoorOnly).extracting(PlaceEntity::getTitle).containsExactly("실내 확인된 카페");
        assertThat(outdoorOnly).isEmpty();
        assertThat(noFilter).hasSize(2);
    }

    @Test
    @DisplayName("delisted 장소는 목록·주변 검색에서 빠지지만 상세 조회는 계속 응답한다")
    void delistedIsHiddenFromSearchButDetailStillWorks() {
        placeRepository.save(place(30L, "영업 중 식당", "33.5000", "126.5300", null));
        PlaceEntity delisted = placeRepository.save(
            baseBuilder(31L, "등록 철회된 식당").contentTypeId("39")
                .lat(new BigDecimal("33.5005")).lng(new BigDecimal("126.5305"))
                .indoor(Boolean.TRUE)
                .delistedAt(LocalDateTime.now())
                .build());

        List<PlaceEntity> nearby = placeRepository.searchNearby(criteria().build());
        assertThat(nearby).extracting(PlaceEntity::getTitle).containsExactly("영업 중 식당");

        // 기존 일정이 참조할 수 있어 상세는 살아 있어야 한다
        assertThat(placeRepository.findByIdAndMergedIntoIdIsNull(delisted.getId())).isPresent();
    }

    @Test
    @DisplayName("내 반려견 크기로 거르면 받아 주지 않는 곳만 빠지고 정보 없음은 남는다")
    void petSizeFilterKeepsUnknown() {
        placeRepository.save(baseBuilder(40L, "전 견종 카페").contentTypeId("39")
            .lat(new BigDecimal("33.5000")).lng(new BigDecimal("126.5300"))
            .allowedPetSize(AllowedPetSize.ALL).build());
        placeRepository.save(baseBuilder(41L, "소형견만 카페").contentTypeId("39")
            .lat(new BigDecimal("33.5001")).lng(new BigDecimal("126.5301"))
            .allowedPetSize(AllowedPetSize.SMALL_ONLY).build());
        placeRepository.save(baseBuilder(42L, "크기 정보 없는 식당").contentTypeId("39")
            .lat(new BigDecimal("33.5002")).lng(new BigDecimal("126.5302"))
            .allowedPetSize(AllowedPetSize.UNKNOWN).build());

        List<PlaceEntity> forMedium = placeRepository.searchNearby(
            criteria().petSizeType(PetSizeType.MEDIUM).build());

        // 소형견만 받는 곳은 빠지고, 정보 없음은 "불가"로 단정하지 않아 남는다
        assertThat(forMedium).extracting(PlaceEntity::getTitle)
            .containsExactlyInAnyOrder("전 견종 카페", "크기 정보 없는 식당");
    }

    @Test
    @DisplayName("체중 상한이 명시된 곳은 kg 숫자로 정확히 거른다")
    void petWeightFilterUsesExplicitLimit() {
        // "12kg 미만" — enum 으로는 SMALL_MEDIUM 이라 20kg 중형견도 통과해 버리는 자리
        placeRepository.save(baseBuilder(50L, "12kg 상한 카페").contentTypeId("39")
            .lat(new BigDecimal("33.5000")).lng(new BigDecimal("126.5300"))
            .allowedPetSize(AllowedPetSize.SMALL_MEDIUM).maxPetWeightKg(12).build());
        placeRepository.save(baseBuilder(51L, "상한 없는 카페").contentTypeId("39")
            .lat(new BigDecimal("33.5001")).lng(new BigDecimal("126.5301"))
            .allowedPetSize(AllowedPetSize.SMALL_MEDIUM).build());

        List<PlaceEntity> for15kg = placeRepository.searchNearby(
            criteria().petSizeType(PetSizeType.MEDIUM).petWeightKg(15).build());

        assertThat(for15kg).extracting(PlaceEntity::getTitle).containsExactly("상한 없는 카페");
    }

    private NearbyPlaceCriteria.NearbyPlaceCriteriaBuilder criteria() {
        return NearbyPlaceCriteria.builder()
            .lat(CENTER_LAT)
            .lng(CENTER_LNG)
            .radius(RADIUS_3KM)
            .size(20);
    }

    private PlaceEntity place(long id, String title, String lat, String lng, Long mergedIntoId) {
        return place(id, title, lat, lng, mergedIntoId, null, Boolean.TRUE);
    }

    private PlaceEntity place(long id, String title, String lat, String lng,
        Long mergedIntoId, String sourceCategory) {
        return place(id, title, lat, lng, mergedIntoId, sourceCategory, Boolean.TRUE);
    }

    private PlaceEntity place(long id, String title, String lat, String lng,
        Long mergedIntoId, String sourceCategory, Boolean indoor) {
        return baseBuilder(id, title)
            .contentTypeId("39")
            .sourceCategory(sourceCategory)
            .lat(new BigDecimal(lat))
            .lng(new BigDecimal(lng))
            .indoor(indoor)
            .mergedIntoId(mergedIntoId)
            .build();
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

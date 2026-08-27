package com.hondigagae.domainlayer.emergency.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.emergency.adapter.out.persistence.entity.EmergencyFacilityEntity;
import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import com.hondigagae.domainlayer.emergency.domain.enums.EmergencyFacilityType;
import com.hondigagae.persistence.config.QuerydslConfigurer;
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
 * 긴급 시설 반경 검색(QueryDSL) 검증.
 *
 * <p>동적 조건 조립은 컴파일로 검증되지 않아 실제로 스키마를 만들고 질의해 본다.
 * 종류·24시간 필터가 켜고 꺼지는 방식과 delisted 제외가 핵심이다.
 */
@DataJpaTest(includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
    classes = EmergencyFacilityRepository.class))
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
class EmergencyFacilityRepositoryTest {

    private static final double CENTER_LAT = 33.5000;
    private static final double CENTER_LNG = 126.5300;
    private static final int RADIUS_3KM = 3_000;

    @Autowired
    private EmergencyFacilityRepository emergencyFacilityRepository;

    @Test
    @DisplayName("사각 범위 안의 시설을 찾고, 종류를 지정하지 않으면 병원과 약국이 함께 나온다")
    void searchWithinBoxAcrossTypes() {
        emergencyFacilityRepository.save(
            facility(1L, "제주24시동물병원", EmergencyFacilityType.ANIMAL_HOSPITAL, "33.5000", "126.5300", true));
        emergencyFacilityRepository.save(
            facility(2L, "가까운약국", EmergencyFacilityType.ANIMAL_PHARMACY, "33.5010", "126.5310", false));
        // 범위 밖 (서귀포 방면)
        emergencyFacilityRepository.save(
            facility(3L, "서귀포동물병원", EmergencyFacilityType.ANIMAL_HOSPITAL, "33.2500", "126.5600", true));

        List<EmergencyFacilityEntity> all = emergencyFacilityRepository.searchWithinBox(query().build());

        assertThat(all).extracting(EmergencyFacilityEntity::getName)
            .containsExactlyInAnyOrder("제주24시동물병원", "가까운약국");
    }

    @Test
    @DisplayName("종류로 거르면 그 종류만 나온다")
    void filterByFacilityType() {
        emergencyFacilityRepository.save(
            facility(10L, "제주동물병원", EmergencyFacilityType.ANIMAL_HOSPITAL, "33.5000", "126.5300", false));
        emergencyFacilityRepository.save(
            facility(11L, "건강약국", EmergencyFacilityType.ANIMAL_PHARMACY, "33.5010", "126.5310", false));

        List<EmergencyFacilityEntity> pharmacies = emergencyFacilityRepository.searchWithinBox(
            query().facilityType(EmergencyFacilityType.ANIMAL_PHARMACY).build());

        assertThat(pharmacies).extracting(EmergencyFacilityEntity::getName).containsExactly("건강약국");
    }

    @Test
    @DisplayName("open24Only 를 끄면 24시간 여부를 따지지 않는다")
    void open24FilterIsOptional() {
        emergencyFacilityRepository.save(
            facility(20L, "제주24시동물병원", EmergencyFacilityType.ANIMAL_HOSPITAL, "33.5000", "126.5300", true));
        emergencyFacilityRepository.save(
            facility(21L, "성산동물병원", EmergencyFacilityType.ANIMAL_HOSPITAL, "33.5010", "126.5310", false));

        List<EmergencyFacilityEntity> all = emergencyFacilityRepository.searchWithinBox(query().build());
        List<EmergencyFacilityEntity> only24 = emergencyFacilityRepository.searchWithinBox(
            query().open24Only(true).build());

        assertThat(all).hasSize(2);
        assertThat(only24).extracting(EmergencyFacilityEntity::getName).containsExactly("제주24시동물병원");
    }

    @Test
    @DisplayName("delisted 시설은 조회에서 빠진다")
    void delistedIsExcluded() {
        emergencyFacilityRepository.save(
            facility(30L, "영업 중 병원", EmergencyFacilityType.ANIMAL_HOSPITAL, "33.5000", "126.5300", false));
        emergencyFacilityRepository.save(EmergencyFacilityEntity.builder()
            .id(31L).sourceKey("key-31")
            .facilityType(EmergencyFacilityType.ANIMAL_HOSPITAL)
            .name("원천에서 빠진 병원").addr("제주특별자치도").sigunguCode("4")
            .lat(new BigDecimal("33.5010")).lng(new BigDecimal("126.5310"))
            .tel("064-000-0000").open24(false)
            .syncedAt(LocalDateTime.now())
            .delistedAt(LocalDateTime.now())
            .build());

        List<EmergencyFacilityEntity> found = emergencyFacilityRepository.searchWithinBox(query().build());

        assertThat(found).extracting(EmergencyFacilityEntity::getName).containsExactly("영업 중 병원");
    }

    private NearbyFacilityQuery.NearbyFacilityQueryBuilder query() {
        return NearbyFacilityQuery.builder()
            .lat(CENTER_LAT)
            .lng(CENTER_LNG)
            .radius(RADIUS_3KM)
            .size(20);
    }

    private EmergencyFacilityEntity facility(long id, String name, EmergencyFacilityType type,
        String lat, String lng, boolean open24) {
        return EmergencyFacilityEntity.builder()
            .id(id)
            .sourceKey("key-" + id)
            .facilityType(type)
            .name(name)
            .addr("제주특별자치도")
            .sigunguCode("4")
            .lat(new BigDecimal(lat))
            .lng(new BigDecimal(lng))
            .tel("064-000-0000")
            .open24(open24)
            .syncedAt(LocalDateTime.now())
            .build();
    }
}

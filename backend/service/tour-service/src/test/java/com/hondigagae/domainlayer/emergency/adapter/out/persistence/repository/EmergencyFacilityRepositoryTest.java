package com.hondigagae.domainlayer.emergency.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.emergency.adapter.out.persistence.entity.EmergencyFacilityEntity;
import com.hondigagae.domainlayer.emergency.domain.enums.EmergencyFacilityType;
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
 * 반경 사각 필터 쿼리 검증.
 *
 * <p>컴파일로는 JPQL 오류를 잡을 수 없어 실제로 스키마를 만들고 질의해 본다.
 * {@code :param is null} 로 조건을 끄는 방식이 종류·24시간 두 필터에서 의도대로 도는지가 핵심이다.
 */
@DataJpaTest(includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
    classes = EmergencyFacilityRepository.class))
// 슬라이스 테스트라도 리포지터리 스캔은 도메인 전체를 덮으므로 엔티티도 같은 범위로 잡아야 한다.
@EntityScan("com.hondigagae.domainlayer")
@EnableJpaAuditing
@TestPropertySource(properties = {
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class EmergencyFacilityRepositoryTest {

    private static final BigDecimal MIN_LAT = new BigDecimal("33.4800");
    private static final BigDecimal MAX_LAT = new BigDecimal("33.5200");
    private static final BigDecimal MIN_LNG = new BigDecimal("126.5000");
    private static final BigDecimal MAX_LNG = new BigDecimal("126.5600");

    @Autowired
    private EmergencyFacilityRepository emergencyFacilityRepository;

    @Test
    @DisplayName("사각 범위 안의 시설을 찾고, 종류를 지정하지 않으면 병원과 약국이 함께 나온다")
    void findWithinBoxAcrossTypes() {
        emergencyFacilityRepository.save(
            facility(1L, "제주24시동물병원", EmergencyFacilityType.ANIMAL_HOSPITAL, "33.5000", "126.5300", true));
        emergencyFacilityRepository.save(
            facility(2L, "가까운약국", EmergencyFacilityType.ANIMAL_PHARMACY, "33.4900", "126.5400", false));
        // 범위 밖 (서귀포 방면)
        emergencyFacilityRepository.save(
            facility(3L, "서귀포동물병원", EmergencyFacilityType.ANIMAL_HOSPITAL, "33.2500", "126.5600", true));

        List<EmergencyFacilityEntity> all = emergencyFacilityRepository.findWithinBox(
            MIN_LAT, MAX_LAT, MIN_LNG, MAX_LNG, null, null);

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

        List<EmergencyFacilityEntity> pharmacies = emergencyFacilityRepository.findWithinBox(
            MIN_LAT, MAX_LAT, MIN_LNG, MAX_LNG, EmergencyFacilityType.ANIMAL_PHARMACY, null);

        assertThat(pharmacies).extracting(EmergencyFacilityEntity::getName).containsExactly("건강약국");
    }

    @Test
    @DisplayName("open24 를 null 로 넘기면 24시간 여부를 따지지 않는다")
    void open24FilterIsOptional() {
        emergencyFacilityRepository.save(
            facility(20L, "제주24시동물병원", EmergencyFacilityType.ANIMAL_HOSPITAL, "33.5000", "126.5300", true));
        emergencyFacilityRepository.save(
            facility(21L, "성산동물병원", EmergencyFacilityType.ANIMAL_HOSPITAL, "33.4900", "126.5400", false));

        List<EmergencyFacilityEntity> all = emergencyFacilityRepository.findWithinBox(
            MIN_LAT, MAX_LAT, MIN_LNG, MAX_LNG, null, null);
        List<EmergencyFacilityEntity> only24 = emergencyFacilityRepository.findWithinBox(
            MIN_LAT, MAX_LAT, MIN_LNG, MAX_LNG, null, Boolean.TRUE);

        assertThat(all).hasSize(2);
        assertThat(only24).extracting(EmergencyFacilityEntity::getName).containsExactly("제주24시동물병원");
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

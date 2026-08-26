package com.hondigagae.domainlayer.emergency.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.emergency.adapter.out.persistence.entity.AnimalHospitalEntity;
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
 * {@code :open24 is null} 로 조건을 끄는 방식이 의도대로 도는지가 핵심이다.
 */
@DataJpaTest(includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
    classes = AnimalHospitalRepository.class))
// 슬라이스 테스트라도 리포지터리 스캔은 도메인 전체를 덮으므로 엔티티도 같은 범위로 잡아야 한다.
@EntityScan("com.hondigagae.domainlayer")
@EnableJpaAuditing
@TestPropertySource(properties = {
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class AnimalHospitalRepositoryTest {

    @Autowired
    private AnimalHospitalRepository animalHospitalRepository;

    @Test
    @DisplayName("사각 범위 안의 동물병원을 찾고, open24 파라미터가 null 이면 24시간 여부를 따지지 않는다")
    void findWithinBox() {
        animalHospitalRepository.save(hospital(1L, "제주24시동물병원", "33.5000", "126.5300", true));
        animalHospitalRepository.save(hospital(2L, "성산동물병원", "33.4900", "126.5400", false));
        // 범위 밖 (서귀포 방면)
        animalHospitalRepository.save(hospital(3L, "서귀포동물병원", "33.2500", "126.5600", true));

        BigDecimal minLat = new BigDecimal("33.4800");
        BigDecimal maxLat = new BigDecimal("33.5200");
        BigDecimal minLng = new BigDecimal("126.5000");
        BigDecimal maxLng = new BigDecimal("126.5600");

        List<AnimalHospitalEntity> all =
            animalHospitalRepository.findWithinBox(minLat, maxLat, minLng, maxLng, null);
        assertThat(all).extracting(AnimalHospitalEntity::getName)
            .containsExactlyInAnyOrder("제주24시동물병원", "성산동물병원");

        List<AnimalHospitalEntity> only24 =
            animalHospitalRepository.findWithinBox(minLat, maxLat, minLng, maxLng, Boolean.TRUE);
        assertThat(only24).extracting(AnimalHospitalEntity::getName)
            .containsExactly("제주24시동물병원");
    }

    private AnimalHospitalEntity hospital(long id, String name, String lat, String lng, boolean open24) {
        return AnimalHospitalEntity.builder()
            .id(id)
            .sourceKey("key-" + id)
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

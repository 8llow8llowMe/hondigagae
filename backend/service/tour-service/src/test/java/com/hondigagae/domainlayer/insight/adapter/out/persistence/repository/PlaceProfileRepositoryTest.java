package com.hondigagae.domainlayer.insight.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import com.hondigagae.persistence.config.QuerydslConfigurer;
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
 * 비 오는 날 실내 대안 질의 검증.
 *
 * <p>실내로 적혀 있어도 들어갈 수 없는 유형(숙박 · 여행코스)이 빠지는지 실제 스키마에 질의해 본다 (#978).
 */
@DataJpaTest(includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
    classes = PlaceProfileRepository.class))
@EntityScan("com.hondigagae.domainlayer")
@EnableJpaAuditing
@Import(QuerydslConfigurer.class)
@TestPropertySource(properties = {
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class PlaceProfileRepositoryTest {

    private static final long ORIGIN_PLACE_ID = 999L;

    @Autowired
    private PlaceProfileRepository placeProfileRepository;

    @Test
    @DisplayName("실내 대안에서 숙박 · 여행코스는 실내로 적혀 있어도 빠진다")
    void excludesNonEnterableContentTypes() {
        placeProfileRepository.save(indoorPlace(1L, "해룡 펜션", ContentType.LODGING));
        placeProfileRepository.save(indoorPlace(2L, "실내 여행코스", ContentType.COURSE));
        placeProfileRepository.save(indoorPlace(3L, "애견 동반 카페", ContentType.RESTAURANT));
        placeProfileRepository.save(indoorPlace(4L, "제주 박물관", ContentType.CULTURE));
        // 기존 조건도 함께 돈다 — 실외 장소와 대안을 찾는 그 장소 자신은 유형과 무관하게 빠진다
        placeProfileRepository.save(place(5L, "야외 카페", ContentType.RESTAURANT, false));
        placeProfileRepository.save(indoorPlace(ORIGIN_PLACE_ID, "정방폭포 옆 실내", ContentType.CULTURE));

        List<PlaceEntity> found = findAroundCenter();

        assertThat(found).extracting(PlaceEntity::getTitle)
            .containsExactlyInAnyOrder("애견 동반 카페", "제주 박물관");
    }

    @Test
    @DisplayName("가까운 실내 장소가 숙박뿐이면 대안은 비어 있다")
    void returnsEmptyWhenOnlyLodgingIsNearby() {
        placeProfileRepository.save(indoorPlace(1L, "해룡 펜션", ContentType.LODGING));
        placeProfileRepository.save(indoorPlace(2L, "다온재 펜션", ContentType.LODGING));

        assertThat(findAroundCenter()).isEmpty();
    }

    @Test
    @DisplayName("추천 후보는 지역 · 유형 · 동반 구분 · 사진 · 좌표 조건을 모두 갖춘 살아 있는 행만이다 (#1368)")
    void findsRecommendationCandidates() {
        placeProfileRepository.save(candidate(1L, "가세오름", ContentType.TOURIST_SPOT).build());
        placeProfileRepository.save(candidate(2L, "제주 박물관", ContentType.CULTURE)
            .petAllowanceType(PetAllowanceType.PARTIALLY_ALLOWED).build());
        placeProfileRepository.save(candidate(3L, "승마장", ContentType.LEPORTS).build());
        // 빠져야 하는 행
        placeProfileRepository.save(candidate(10L, "병합된 행", ContentType.TOURIST_SPOT).mergedIntoId(1L).build());
        placeProfileRepository.save(candidate(11L, "숨긴 행", ContentType.TOURIST_SPOT).delistedAt(LocalDateTime.now()).build());
        placeProfileRepository.save(candidate(12L, "동반 불가", ContentType.TOURIST_SPOT)
            .petAvailable(false).petAllowanceType(PetAllowanceType.NOT_ALLOWED).build());
        placeProfileRepository.save(candidate(13L, "동반 미확인", ContentType.TOURIST_SPOT)
            .petAllowanceType(PetAllowanceType.UNKNOWN).build());
        placeProfileRepository.save(candidate(14L, "사진 없음", ContentType.TOURIST_SPOT).firstImage(null).build());
        placeProfileRepository.save(candidate(15L, "사진 빈 문자열", ContentType.TOURIST_SPOT).firstImage(" ").build());
        placeProfileRepository.save(candidate(16L, "좌표 없음", ContentType.TOURIST_SPOT).lat(null).lng(null).build());
        placeProfileRepository.save(candidate(17L, "면세점", ContentType.SHOPPING).build());
        placeProfileRepository.save(candidate(18L, "애견 카페", ContentType.RESTAURANT).build());
        placeProfileRepository.save(candidate(19L, "다른 지역", ContentType.TOURIST_SPOT).areaCode("1").build());

        List<PlaceEntity> found = placeProfileRepository.findRecommendationCandidates(
            "39", List.of("12", "14", "28"), PlaceProfileRepository.RECOMMENDABLE_PET_ALLOWANCE_TYPES);

        assertThat(found).extracting(PlaceEntity::getTitle).containsExactlyInAnyOrder("가세오름", "제주 박물관", "승마장");
    }

    private PlaceEntity.PlaceEntityBuilder candidate(long id, String title, ContentType contentType) {
        return PlaceEntity.builder()
            .id(id)
            .source(PlaceSource.TOUR_API)
            .sourceKey("key-" + id)
            .contentTypeId(contentType.getCode())
            .title(title)
            .addr1("제주특별자치도 제주시")
            .areaCode("39")
            .sigunguCode("4")
            .lat(new BigDecimal("33.5000"))
            .lng(new BigDecimal("126.5300"))
            .firstImage("https://img/" + id + ".jpg")
            .petAvailable(true)
            .petAllowanceType(PetAllowanceType.ALLOWED)
            .allowedPetSize(AllowedPetSize.UNKNOWN)
            .syncedAt(LocalDateTime.now());
    }

    private List<PlaceEntity> findAroundCenter() {
        return placeProfileRepository.findIndoorWithinBox(
            new BigDecimal("33.40"), new BigDecimal("33.60"),
            new BigDecimal("126.40"), new BigDecimal("126.60"),
            ORIGIN_PLACE_ID, PlaceProfileRepository.NON_ENTERABLE_CONTENT_TYPE_IDS);
    }

    private PlaceEntity indoorPlace(long id, String title, ContentType contentType) {
        return place(id, title, contentType, true);
    }

    private PlaceEntity place(long id, String title, ContentType contentType, boolean indoor) {
        return PlaceEntity.builder()
            .id(id)
            .source(PlaceSource.TOUR_API)
            .sourceKey("key-" + id)
            .contentTypeId(contentType.getCode())
            .title(title)
            .addr1("제주특별자치도 제주시")
            .areaCode("39")
            .sigunguCode("4")
            .lat(new BigDecimal("33.5000"))
            .lng(new BigDecimal("126.5300"))
            .indoor(indoor)
            .petAvailable(true)
            .petAllowanceType(PetAllowanceType.ALLOWED)
            .allowedPetSize(AllowedPetSize.UNKNOWN)
            .syncedAt(LocalDateTime.now())
            .build();
    }
}

package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
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
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.test.context.TestPropertySource;

/**
 * 장소 키워드 검색 (#421). 이름 또는 주소 부분 일치, 기존 필터와 AND.
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
class PlaceRepositoryKeywordSearchTest {

    @Autowired
    private PlaceRepository placeRepository;

    @Test
    @DisplayName("장소명 부분 일치로 찾는다")
    void matchesTitle() {
        placeRepository.save(place(1L, "성산일출봉", "제주특별자치도 서귀포시 성산읍"));
        placeRepository.save(place(2L, "천지연폭포", "제주특별자치도 서귀포시"));

        Slice<PlaceEntity> page = placeRepository.searchByCriteria(listCriteria("성산"));

        assertThat(page.getContent()).extracting(PlaceEntity::getTitle).containsExactly("성산일출봉");
    }

    @Test
    @DisplayName("주소에만 있어도 찾는다")
    void matchesAddress() {
        placeRepository.save(place(1L, "해맞이 카페", "제주특별자치도 서귀포시 성산읍 고성리"));
        placeRepository.save(place(2L, "애월 카페", "제주특별자치도 제주시 애월읍"));

        Slice<PlaceEntity> page = placeRepository.searchByCriteria(listCriteria("성산"));

        assertThat(page.getContent()).extracting(PlaceEntity::getTitle).containsExactly("해맞이 카페");
    }

    @Test
    @DisplayName("공백·빈 키워드는 필터를 걸지 않는다")
    void blankKeywordDoesNotFilter() {
        placeRepository.save(place(1L, "성산일출봉", "제주특별자치도 서귀포시 성산읍"));
        placeRepository.save(place(2L, "천지연폭포", "제주특별자치도 서귀포시"));

        Slice<PlaceEntity> page = placeRepository.searchByCriteria(listCriteria("   "));

        assertThat(page.getContent()).extracting(PlaceEntity::getTitle)
            .containsExactly("성산일출봉", "천지연폭포");
    }

    @Test
    @DisplayName("% 는 와일드카드가 아니라 리터럴이다")
    void percentIsLiteral() {
        placeRepository.save(place(1L, "100% 카페", "제주특별자치도 제주시"));
        placeRepository.save(place(2L, "100퍼센트 카페", "제주특별자치도 제주시"));

        Slice<PlaceEntity> page = placeRepository.searchByCriteria(listCriteria("100%"));

        assertThat(page.getContent()).extracting(PlaceEntity::getTitle).containsExactly("100% 카페");
    }

    @Test
    @DisplayName("주변 검색에도 같은 키워드 규칙이 적용된다")
    void nearbyUsesSameKeywordRule() {
        placeRepository.save(nearby(10L, "성산일출봉", "33.4580", "126.9420"));
        placeRepository.save(nearby(11L, "천지연폭포", "33.2470", "126.5540"));

        List<PlaceEntity> found = placeRepository.searchNearby(NearbyPlaceCriteria.builder()
            .lat(33.4580)
            .lng(126.9420)
            .radius(3_000)
            .keyword("성산")
            .size(20)
            .build());

        assertThat(found).extracting(PlaceEntity::getTitle).containsExactly("성산일출봉");
    }

    @Test
    @DisplayName("각 검색어가 이름 또는 주소 중 서로 다른 필드에 있어도 모두 있으면 찾는다")
    void matchesEveryTokenAcrossTitleAndAddress() {
        placeRepository.save(place(20L, "성산 바다 카페", "제주특별자치도 서귀포시 고성리"));
        placeRepository.save(place(21L, "성산 바다 카페", "제주특별자치도 제주시 애월읍"));
        placeRepository.save(place(22L, "고성리 전망대", "제주특별자치도 서귀포시"));

        Slice<PlaceEntity> page = placeRepository.searchByCriteria(listCriteria("성산 고성리"));

        assertThat(page.getContent()).extracting(PlaceEntity::getId).containsExactly(20L);
    }

    @Test
    @DisplayName("같은 필드의 검색어는 떨어져 있거나 역순이어도 모두 있으면 찾는다")
    void matchesNonAdjacentAndReversedTokensInSameField() {
        placeRepository.save(place(30L, "고성리 해변 산책 성산 카페", "제주특별자치도 서귀포시"));

        Slice<PlaceEntity> page = placeRepository.searchByCriteria(listCriteria("성산 고성리"));

        assertThat(page.getContent()).extracting(PlaceEntity::getId).containsExactly(30L);
    }

    @Test
    @DisplayName("유니코드 공백으로 나뉜 여러 검색어를 정규화해 모두 찾는다")
    void normalizesUnicodeWhitespaceBetweenTokens() {
        placeRepository.save(place(31L, "성산 바다 카페", "제주특별자치도 서귀포시 고성리"));

        Slice<PlaceEntity> page = placeRepository.searchByCriteria(
            listCriteria("\u00A0성산\u3000고성리\u00A0"));

        assertThat(page.getContent()).extracting(PlaceEntity::getId).containsExactly(31L);
    }

    @Test
    @DisplayName("영문 여러 검색어는 대소문자와 관계없이 모두 찾는다")
    void matchesMultipleTokensCaseInsensitively() {
        placeRepository.save(place(32L, "Jeju Dog Cafe", "Seogwipo City"));
        placeRepository.save(place(33L, "Jeju Dog Park", "Seogwipo City"));

        Slice<PlaceEntity> page = placeRepository.searchByCriteria(listCriteria("jEjU cAfE"));

        assertThat(page.getContent()).extracting(PlaceEntity::getId).containsExactly(32L);
    }

    @Test
    @DisplayName("여러 검색어의 LIKE 특수문자는 각각 리터럴로 처리한다")
    void specialLikeCharactersAreLiteralForEveryToken() {
        placeRepository.save(place(40L, "100% 바다_카페 C\\길", "제주특별자치도 제주시"));
        placeRepository.save(place(41L, "100퍼센트 바다X카페", "제주특별자치도 제주시"));

        Slice<PlaceEntity> page = placeRepository.searchByCriteria(listCriteria("  100% \t 바다_   C\\길  "));

        assertThat(page.getContent()).extracting(PlaceEntity::getId).containsExactly(40L);
    }

    @Test
    @DisplayName("주변 검색은 모든 검색어와 기존 필터·노출 조건을 함께 적용한다")
    void nearbyCombinesAllTokensWithFiltersAndVisibility() {
        placeRepository.save(nearbyBuilder(50L, "성산 반려견 카페", "고성리", "33.4580", "126.9420")
            .sourceCategory("카페")
            .build());
        placeRepository.save(nearbyBuilder(51L, "성산 반려견 식당", "고성리", "33.4581", "126.9421")
            .sourceCategory("식당")
            .build());
        placeRepository.save(nearbyBuilder(52L, "성산 반려견 카페", "고성리", "33.4582", "126.9422")
            .sourceCategory("카페")
            .delistedAt(LocalDateTime.now())
            .build());
        placeRepository.save(nearbyBuilder(53L, "성산 반려견 카페", "애월읍", "33.4583", "126.9423")
            .sourceCategory("카페")
            .build());

        List<PlaceEntity> found = placeRepository.searchNearby(NearbyPlaceCriteria.builder()
            .lat(33.4580)
            .lng(126.9420)
            .radius(3_000)
            .contentType(ContentType.TOURIST_SPOT)
            .sourceCategory("카페")
            .keyword("성산 고성리")
            .size(20)
            .build());

        assertThat(found).extracting(PlaceEntity::getId).containsExactly(50L);
    }

    @Test
    @DisplayName("목록 검색은 여러 검색어와 커서를 함께 적용한다")
    void listCombinesAllTokensWithCursor() {
        placeRepository.save(place(60L, "성산 카페", "고성리"));
        placeRepository.save(place(61L, "성산 카페", "고성리"));

        PlaceSearchCriteria criteria = listCriteria("성산 고성리").toBuilder()
            .lastPlaceId(60L)
            .build();

        assertThat(placeRepository.searchByCriteria(criteria).getContent())
            .extracting(PlaceEntity::getId)
            .containsExactly(61L);
    }

    private PlaceSearchCriteria listCriteria(String keyword) {
        return PlaceSearchCriteria.builder().areaCode("39").keyword(keyword).size(20).build();
    }

    private PlaceEntity place(long id, String title, String addr1) {
        return baseBuilder(id, title).addr1(addr1).build();
    }

    private PlaceEntity nearby(long id, String title, String lat, String lng) {
        return baseBuilder(id, title)
            .lat(new BigDecimal(lat))
            .lng(new BigDecimal(lng))
            .build();
    }

    private PlaceEntity.PlaceEntityBuilder nearbyBuilder(
        long id, String title, String addr1, String lat, String lng
    ) {
        return baseBuilder(id, title)
            .addr1(addr1)
            .lat(new BigDecimal(lat))
            .lng(new BigDecimal(lng));
    }

    private PlaceEntity.PlaceEntityBuilder baseBuilder(long id, String title) {
        return PlaceEntity.builder()
            .id(id)
            .source(PlaceSource.TOUR_API)
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

package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
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

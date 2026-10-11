package com.hondigagae.domainlayer.insight.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.CongestionForecastEntity;
import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.PlaceNameLinkEntity;
import com.hondigagae.domainlayer.insight.adapter.out.persistence.repository.custom.PlaceLinkedCongestionForecast;
import com.hondigagae.shared.travel.insight.NameLinkSourceType;
import com.hondigagae.shared.travel.insight.NameMatchType;
import com.hondigagae.persistence.config.QuerydslConfigurer;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.test.context.TestPropertySource;

/**
 * 링크 테이블 조인(QueryDSL 엔티티 조인) 검증.
 *
 * <p>연관관계 없는 두 엔티티를 on 절로 잇는 형태라 컴파일만으로는 확신할 수 없어
 * 실제 스키마에 질의해 본다. UNMATCHED 링크를 타고 엉뚱한 혼잡도가 붙지 않는 것이 핵심이다.
 */
@DataJpaTest(includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
    classes = CongestionForecastRepository.class))
@EntityScan("com.hondigagae.domainlayer")
@EnableJpaAuditing
@Import(QuerydslConfigurer.class)
@TestPropertySource(properties = {
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class CongestionForecastRepositoryTest {

    private static final long PLACE_ID = 100L;

    @Autowired
    private CongestionForecastRepository congestionForecastRepository;

    // 링크 엔티티는 배치가 JDBC 로만 쓰고 조회 리포지터리가 없다. 테스트 저장은 EntityManager 로 한다.
    @Autowired
    private TestEntityManager entityManager;

    @Test
    @DisplayName("링크를 조인해 장소의 예측만 날짜 순으로 가져오고, 매칭 실패 링크는 타지 않는다")
    void joinsThroughLinkAndSkipsUnmatched() {
        // 정상 매칭된 링크 + 그 관광지의 예측 이틀치
        entityManager.persistAndFlush(link(1L, PLACE_ID, "성산일출봉", NameMatchType.EXACT));
        congestionForecastRepository.save(forecast(10L, "성산일출봉", "20260901", 42.5));
        congestionForecastRepository.save(forecast(11L, "성산일출봉", "20260902", 55.0));
        // 날짜 범위 밖
        congestionForecastRepository.save(forecast(12L, "성산일출봉", "20261001", 70.0));

        // 매칭 실패 링크 — 이 행을 타고 엉뚱한 관광지의 예측이 붙으면 안 된다
        entityManager.persistAndFlush(link(2L, PLACE_ID, "엉뚱한관광지", NameMatchType.UNMATCHED));
        congestionForecastRepository.save(forecast(13L, "엉뚱한관광지", "20260901", 99.0));

        List<CongestionForecastEntity> found = congestionForecastRepository
            .findLinkedByPlaceIdAndDateRange(PLACE_ID, "20260901", "20260930", NameLinkSourceType.CONGESTION);

        assertThat(found).extracting(CongestionForecastEntity::getBaseYmd)
            .containsExactly("20260901", "20260902");
        assertThat(found).extracting(CongestionForecastEntity::getTatsNm)
            .containsOnly("성산일출봉");
    }

    @Test
    @DisplayName("여러 장소의 하루치 예측을 한 쿼리로 가져오고, 어느 장소 것인지 링크의 장소 아이디로 가른다 (#1368)")
    void findsManyPlacesOnOneDate() {
        entityManager.persistAndFlush(link(1L, 100L, "성산일출봉", NameMatchType.EXACT));
        entityManager.persistAndFlush(link(2L, 200L, "만장굴", NameMatchType.EXACT));
        // 매칭 실패 링크와 요청하지 않은 장소의 링크
        entityManager.persistAndFlush(link(3L, 300L, "엉뚱한관광지", NameMatchType.UNMATCHED));
        entityManager.persistAndFlush(link(4L, 400L, "천지연폭포", NameMatchType.EXACT));

        congestionForecastRepository.save(forecast(10L, "성산일출봉", "20260901", 42.5));
        congestionForecastRepository.save(forecast(11L, "성산일출봉", "20260902", 55.0));
        congestionForecastRepository.save(forecast(12L, "만장굴", "20260901", 12.0));
        congestionForecastRepository.save(forecast(13L, "엉뚱한관광지", "20260901", 99.0));
        congestionForecastRepository.save(forecast(14L, "천지연폭포", "20260901", 80.0));

        List<PlaceLinkedCongestionForecast> found = congestionForecastRepository
            .findLinkedByPlaceIdsAndDate(List.of(200L, 100L, 300L), "20260901", NameLinkSourceType.CONGESTION);

        assertThat(found).extracting(PlaceLinkedCongestionForecast::placeId).containsExactly(100L, 200L);
        assertThat(found).extracting(linked -> linked.forecast().getCnctrRate()).containsExactly(42.5, 12.0);
    }

    @Test
    @DisplayName("한 장소에 링크가 여럿이면 단건 · 여러 장소 조회가 같은 예측(아이디 작은 것)을 먼저 준다")
    void duplicateLinksOrderSameInSingleAndBatch() {
        entityManager.persistAndFlush(link(1L, PLACE_ID, "성산일출봉", NameMatchType.EXACT));
        entityManager.persistAndFlush(link(2L, PLACE_ID, "성산일출봉 입구", NameMatchType.EXACT));
        // 아이디가 큰 쪽을 먼저 저장해 삽입 순서가 아니라 정렬이 고르는지 본다.
        congestionForecastRepository.save(forecast(21L, "성산일출봉 입구", "20260901", 90.0));
        congestionForecastRepository.save(forecast(20L, "성산일출봉", "20260901", 30.0));

        List<CongestionForecastEntity> single = congestionForecastRepository
            .findLinkedByPlaceIdAndDateRange(PLACE_ID, "20260901", "20260901", NameLinkSourceType.CONGESTION);
        List<PlaceLinkedCongestionForecast> batch = congestionForecastRepository
            .findLinkedByPlaceIdsAndDate(List.of(PLACE_ID), "20260901", NameLinkSourceType.CONGESTION);

        assertThat(single).extracting(CongestionForecastEntity::getId).containsExactly(20L, 21L);
        assertThat(batch).extracting(linked -> linked.forecast().getId()).containsExactly(20L, 21L);
    }

    @Test
    @DisplayName("장소 목록이 비면 질의하지 않고 빈 목록이다")
    void emptyPlaceIdsYieldEmpty() {
        assertThat(congestionForecastRepository.findLinkedByPlaceIdsAndDate(List.of(), "20260901", NameLinkSourceType.CONGESTION))
            .isEmpty();
    }

    private PlaceNameLinkEntity link(long id, long placeId, String tatsNm, NameMatchType matchType) {
        return PlaceNameLinkEntity.builder()
            .id(id)
            .sourceType(NameLinkSourceType.CONGESTION)
            .areaCd("50")
            .signguCd("50130")
            .tatsNm(tatsNm)
            .placeId(placeId)
            .matchType(matchType)
            .syncedAt(LocalDateTime.now())
            .build();
    }

    private CongestionForecastEntity forecast(long id, String tatsNm, String baseYmd, double rate) {
        return CongestionForecastEntity.builder()
            .id(id)
            .baseYmd(baseYmd)
            .areaCd("50")
            .signguCd("50130")
            .tatsNm(tatsNm)
            .cnctrRate(rate)
            .syncedAt(LocalDateTime.now())
            .build();
    }
}

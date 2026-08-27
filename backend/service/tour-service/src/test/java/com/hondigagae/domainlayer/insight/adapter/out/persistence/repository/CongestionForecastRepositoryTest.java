package com.hondigagae.domainlayer.insight.adapter.out.persistence.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.CongestionForecastEntity;
import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.PlaceNameLinkEntity;
import com.hondigagae.domainlayer.insight.domain.enums.NameLinkSourceType;
import com.hondigagae.domainlayer.insight.domain.enums.NameMatchType;
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

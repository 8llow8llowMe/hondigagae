package com.hondigagae.domainlayer.insight.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.CongestionForecastEntity;
import com.hondigagae.domainlayer.insight.adapter.out.persistence.repository.CongestionForecastRepository;
import com.hondigagae.domainlayer.insight.adapter.out.persistence.repository.custom.PlaceLinkedCongestionForecast;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapperImpl;
import com.hondigagae.domainlayer.insight.domain.enums.CongestionLevel;
import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import com.hondigagae.shared.travel.insight.NameLinkSourceType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 여러 장소의 혼잡도 일괄 조회 (#1368). 질의 자체(조인 · 정렬)는 {@code CongestionForecastRepositoryTest} 가 H2 로 본다.
 * 여기서는 어댑터가 결과를 장소별로 접는 규칙을 본다.
 */
class CongestionForecastPersistenceAdapterTest {

    private static final LocalDate DATE = LocalDate.of(2026, 9, 1);

    private final CongestionForecastRepository repository = mock(CongestionForecastRepository.class);
    private final CongestionForecastPersistenceAdapter adapter =
        new CongestionForecastPersistenceAdapter(repository, new InsightMapperImpl());

    @Test
    @DisplayName("요청한 아이디는 전부 키로 있고, 예측이 없는 장소는 UNKNOWN 이다")
    void everyRequestedIdIsPresent() {
        when(repository.findLinkedByPlaceIdsAndDate(any(), eq("20260901"), eq(NameLinkSourceType.CONGESTION)))
            .thenReturn(List.of(new PlaceLinkedCongestionForecast(100L, forecast(10L, 42.5d))));

        Map<Long, CongestionSnapshot> snapshots = adapter.findByPlacesAndDate(List.of(100L, 200L), DATE);

        assertThat(snapshots).containsOnlyKeys(100L, 200L);
        assertThat(snapshots.get(100L).concentrationRate()).isEqualTo(42.5d);
        assertThat(snapshots.get(100L).date()).isEqualTo(DATE);
        // 모름은 한산함이 아니다 — 집중률 0 이 아니라 null 이다.
        assertThat(snapshots.get(200L).level()).isEqualTo(CongestionLevel.UNKNOWN);
        assertThat(snapshots.get(200L).concentrationRate()).isNull();
    }

    @Test
    @DisplayName("한 장소에 링크가 여럿이면 질의 순서의 첫 건을 쓴다 — 단건 조회와 같은 건이다")
    void duplicateLinksKeepFirstByOrdering() {
        when(repository.findLinkedByPlaceIdsAndDate(any(), any(), any())).thenReturn(List.of(
            new PlaceLinkedCongestionForecast(100L, forecast(10L, 20.0d)),
            new PlaceLinkedCongestionForecast(100L, forecast(11L, 90.0d))));

        Map<Long, CongestionSnapshot> snapshots = adapter.findByPlacesAndDate(List.of(100L), DATE);

        assertThat(snapshots.get(100L).concentrationRate()).isEqualTo(20.0d);
    }

    private static CongestionForecastEntity forecast(long id, double rate) {
        return CongestionForecastEntity.builder()
            .id(id)
            .baseYmd("20260901")
            .areaCd("50")
            .signguCd("50130")
            .tatsNm("관광지" + id)
            .cnctrRate(rate)
            .syncedAt(LocalDateTime.now())
            .build();
    }
}

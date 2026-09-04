package com.hondigagae.domainlayer.insight.domain.enums;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * "예보가 없다" 를 세 가지로 가르는 규칙.
 *
 * <p>이 구분이 없으면 밤마다 일어나는 정상 상태가 장애로 보고된다 — 기상청 단기예보 23시
 * 회차는 자기 발표일 행을 하나도 주지 않기 때문에(실측: {@code base_time=2300} 의 최초 예보가
 * 익일 0000), 23시 이후 자정까지는 오늘의 시각별 예보가 원천에 <b>존재하지 않는다.</b>
 */
class ForecastCoverageTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 3);

    @Test
    @DisplayName("그 날짜가 있으면 쓸 수 있다")
    void availableWhenDatePresent() {
        ForecastCoverage coverage = ForecastCoverage.of(TODAY, Set.of(TODAY, TODAY.plusDays(1)));

        assertThat(coverage).isEqualTo(ForecastCoverage.AVAILABLE);
        assertThat(coverage.isUsable()).isTrue();
        assertThat(coverage.isFailure()).isFalse();
    }

    @Test
    @DisplayName("예보가 내일부터면 오늘은 '지났다' 이지 '못 받았다' 가 아니다")
    void dayEndedWhenForecastStartsAfterTarget() {
        // 23시 회차를 받은 직후의 모습이다. 재시도해도 자정 전에는 오늘이 채워지지 않는다.
        ForecastCoverage coverage = ForecastCoverage.of(
            TODAY, Set.of(TODAY.plusDays(1), TODAY.plusDays(2), TODAY.plusDays(3)));

        assertThat(coverage).isEqualTo(ForecastCoverage.DAY_ENDED);
        assertThat(coverage.isFailure()).isFalse();
    }

    @Test
    @DisplayName("예보 범위보다 뒤면 아직 안 온 것이다")
    void outOfRangeWhenTargetIsBeyondForecast() {
        ForecastCoverage coverage = ForecastCoverage.of(
            TODAY.plusDays(9), Set.of(TODAY, TODAY.plusDays(1)));

        assertThat(coverage).isEqualTo(ForecastCoverage.OUT_OF_RANGE);
        assertThat(coverage.isFailure()).isFalse();
    }

    @Test
    @DisplayName("목록 자체가 없어야 장애다")
    void unavailableOnlyWhenNothingCameBack() {
        assertThat(ForecastCoverage.of(TODAY, List.of())).isEqualTo(ForecastCoverage.UNAVAILABLE);
        assertThat(ForecastCoverage.of(TODAY, null)).isEqualTo(ForecastCoverage.UNAVAILABLE);
        assertThat(ForecastCoverage.UNAVAILABLE.isFailure()).isTrue();
    }

    @Test
    @DisplayName("장애로 세는 것은 UNAVAILABLE 하나뿐이다")
    void onlyUnavailableCountsAsFailure() {
        // 이 경계가 무너지면 정상 상태가 5xx 로 나간다. 값을 늘릴 때 함께 판단하라는 뜻이다.
        assertThat(ForecastCoverage.values())
            .filteredOn(ForecastCoverage::isFailure)
            .containsExactly(ForecastCoverage.UNAVAILABLE);
    }
}

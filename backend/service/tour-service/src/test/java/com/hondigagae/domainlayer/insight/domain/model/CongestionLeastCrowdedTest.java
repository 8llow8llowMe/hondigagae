package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 기간 중 가장 덜 붐비는 날 (#425).
 *
 * <p>범위 조회의 답은 "언제 덜 붐비나"다({@code DailyCongestionItem} javadoc). 고르는 규칙이
 * 한 곳에 있어야 화면과 다른 호출부가 같은 기간에 다른 날을 추천하지 않는다.
 */
class CongestionLeastCrowdedTest {

    private static final LocalDate DATE = LocalDate.of(2026, 9, 10);

    @Test
    @DisplayName("집중률이 가장 낮은 날을 고르고, 동률이면 가장 이른 날짜다")
    void picksLowestRateAndEarliestOnTie() {
        List<CongestionSnapshot> snapshots = List.of(
            CongestionSnapshot.of(DATE, 62.0),
            CongestionSnapshot.of(DATE.plusDays(1), 31.5),
            CongestionSnapshot.of(DATE.plusDays(2), 31.5),
            CongestionSnapshot.of(DATE.plusDays(3), 48.0));

        CongestionSnapshot least = CongestionSnapshot.leastCrowded(snapshots).orElseThrow();

        assertThat(least.date()).isEqualTo(DATE.plusDays(1));
        assertThat(least.concentrationRate()).isEqualTo(31.5);
    }

    @Test
    @DisplayName("UNKNOWN 은 후보가 아니다 - 데이터 없음은 한산함이 아니다")
    void unknownIsNotACandidate() {
        List<CongestionSnapshot> snapshots = List.of(
            CongestionSnapshot.unknown(DATE),
            CongestionSnapshot.of(DATE.plusDays(1), 90.0));

        assertThat(CongestionSnapshot.leastCrowded(snapshots).orElseThrow().date())
            .isEqualTo(DATE.plusDays(1));
    }

    @Test
    @DisplayName("아는 날이 하나도 없으면 비운다 - 지어내지 않는다")
    void allUnknownYieldsEmpty() {
        List<CongestionSnapshot> snapshots = List.of(
            CongestionSnapshot.unknown(DATE), CongestionSnapshot.unknown(DATE.plusDays(1)));

        assertThat(CongestionSnapshot.leastCrowded(snapshots)).isEmpty();
        assertThat(CongestionSnapshot.leastCrowded(null)).isEmpty();
    }
}

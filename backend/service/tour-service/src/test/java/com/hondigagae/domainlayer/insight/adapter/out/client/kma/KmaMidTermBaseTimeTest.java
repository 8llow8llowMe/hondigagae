package com.hondigagae.domainlayer.insight.adapter.out.client.kma;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 중기예보는 1일 2회(06, 18시) 발표라 단기예보(8회)와 주기가 다르다.
 *
 * <p>일차 계산이 특히 중요하다. 응답 필드명에 일차가 박혀 있고({@code wf3Am}) 그 일차는
 * <b>발표일 기준</b>이라, 18시 회차를 다음 날 새벽에 조회할 때 조회일에서 세면 하루가 밀린다.
 */
class KmaMidTermBaseTimeTest {

    private static final int PUBLISH_DELAY_MINUTES = 20;

    @Test
    @DisplayName("발표시각 직후 여유 시간 안에는 직전 회차를 쓴다")
    void usesPreviousRoundWithinPublishDelay() {
        KmaMidTermBaseTime baseTime = KmaMidTermBaseTime.latestAvailable(
            LocalDateTime.of(2026, 8, 27, 18, 5), PUBLISH_DELAY_MINUTES);

        assertThat(baseTime.tmFcParam()).isEqualTo("202608270600");
    }

    @Test
    @DisplayName("여유 시간이 지나면 해당 회차를 쓴다")
    void usesCurrentRoundAfterPublishDelay() {
        KmaMidTermBaseTime baseTime = KmaMidTermBaseTime.latestAvailable(
            LocalDateTime.of(2026, 8, 27, 18, 40), PUBLISH_DELAY_MINUTES);

        assertThat(baseTime.tmFcParam()).isEqualTo("202608271800");
    }

    @Test
    @DisplayName("자정부터 06시 전까지는 어제 18시 회차를 쓴다")
    void rollsBackToYesterdayEveningRound() {
        KmaMidTermBaseTime baseTime = KmaMidTermBaseTime.latestAvailable(
            LocalDateTime.of(2026, 8, 27, 3, 0), PUBLISH_DELAY_MINUTES);

        assertThat(baseTime.tmFcParam()).isEqualTo("202608261800");
    }

    @Test
    @DisplayName("일차는 조회일이 아니라 발표일에서 센다")
    void countsDayOffsetFromPublishDate() {
        // 8월 26일 18시 발표를 27일 새벽에 조회한 상황.
        KmaMidTermBaseTime baseTime = KmaMidTermBaseTime.latestAvailable(
            LocalDateTime.of(2026, 8, 27, 3, 0), PUBLISH_DELAY_MINUTES);

        // 3일차는 발표일(26일) + 3 = 29일이다. 조회일(27일)에서 세면 30일이 되어 하루 밀린다.
        assertThat(baseTime.dateOfDayOffset(3)).isEqualTo(LocalDate.of(2026, 8, 29));
        assertThat(baseTime.dateOfDayOffset(10)).isEqualTo(LocalDate.of(2026, 9, 5));
    }

    @Test
    @DisplayName("직전 회차 폴백은 날짜 경계를 넘어간다")
    void previousRoundCrossesDateBoundary() {
        KmaMidTermBaseTime baseTime = KmaMidTermBaseTime.latestAvailable(
            LocalDateTime.of(2026, 8, 27, 7, 0), PUBLISH_DELAY_MINUTES);
        assertThat(baseTime.tmFcParam()).isEqualTo("202608270600");

        assertThat(baseTime.previous().tmFcParam()).isEqualTo("202608261800");
    }

    @Test
    @DisplayName("다음 발표 시각이 캐시 수명의 기준이 된다")
    void nextAvailableAtDrivesCacheLifetime() {
        KmaMidTermBaseTime morning = KmaMidTermBaseTime.latestAvailable(
            LocalDateTime.of(2026, 8, 27, 7, 0), PUBLISH_DELAY_MINUTES);
        assertThat(morning.nextAvailableAt(PUBLISH_DELAY_MINUTES))
            .isEqualTo(LocalDateTime.of(2026, 8, 27, 18, 20));

        KmaMidTermBaseTime evening = KmaMidTermBaseTime.latestAvailable(
            LocalDateTime.of(2026, 8, 27, 19, 0), PUBLISH_DELAY_MINUTES);
        assertThat(evening.nextAvailableAt(PUBLISH_DELAY_MINUTES))
            .isEqualTo(LocalDateTime.of(2026, 8, 28, 6, 20));
    }
}

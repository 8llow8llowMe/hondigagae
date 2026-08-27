package com.hondigagae.domainlayer.insight.adapter.out.client.kma;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 발표 회차 계산은 기상청 연동에서 가장 흔하게 밟는 지점이다. 회차 직후 몇 분 동안은
 * 데이터가 아직 올라오지 않아 빈 응답이 오는데, 그 구간을 계산이 잘못 짚으면
 * "가끔 날씨가 안 나온다"는 재현 어려운 증상이 된다.
 */
class KmaBaseTimeTest {

    private static final int PUBLISH_DELAY_MINUTES = 10;

    @Test
    @DisplayName("발표시각 직후 여유 시간 안에는 직전 회차를 쓴다")
    void usesPreviousRoundWithinPublishDelay() {
        // 14시 발표, 아직 5분밖에 지나지 않아 데이터가 없다.
        KmaBaseTime baseTime = KmaBaseTime.latestAvailable(
            LocalDateTime.of(2026, 8, 27, 14, 5), PUBLISH_DELAY_MINUTES);

        assertThat(baseTime.baseTimeParam()).isEqualTo("1100");
        assertThat(baseTime.baseDateParam()).isEqualTo("20260827");
    }

    @Test
    @DisplayName("여유 시간이 지나면 해당 회차를 쓴다")
    void usesCurrentRoundAfterPublishDelay() {
        KmaBaseTime baseTime = KmaBaseTime.latestAvailable(
            LocalDateTime.of(2026, 8, 27, 14, 30), PUBLISH_DELAY_MINUTES);

        assertThat(baseTime.baseTimeParam()).isEqualTo("1400");
    }

    @Test
    @DisplayName("자정부터 첫 발표 전까지는 어제 마지막 회차를 쓴다")
    void rollsBackToYesterdayBeforeFirstPublish() {
        KmaBaseTime baseTime = KmaBaseTime.latestAvailable(
            LocalDateTime.of(2026, 8, 27, 0, 30), PUBLISH_DELAY_MINUTES);

        assertThat(baseTime.baseDateParam()).isEqualTo("20260826");
        assertThat(baseTime.baseTimeParam()).isEqualTo("2300");
    }

    @Test
    @DisplayName("직전 회차 폴백은 날짜 경계를 넘어간다")
    void previousRoundCrossesDateBoundary() {
        KmaBaseTime baseTime = KmaBaseTime.latestAvailable(
            LocalDateTime.of(2026, 8, 27, 2, 30), PUBLISH_DELAY_MINUTES);
        assertThat(baseTime.baseTimeParam()).isEqualTo("0200");

        KmaBaseTime previous = baseTime.previous();

        assertThat(previous.baseDateParam()).isEqualTo("20260826");
        assertThat(previous.baseTimeParam()).isEqualTo("2300");
    }

    @Test
    @DisplayName("다음 발표 시각은 캐시 수명의 기준이 된다")
    void nextAvailableAtDrivesCacheLifetime() {
        KmaBaseTime baseTime = KmaBaseTime.latestAvailable(
            LocalDateTime.of(2026, 8, 27, 14, 30), PUBLISH_DELAY_MINUTES);

        // 14시 회차 다음은 17시 발표 + 여유 10분.
        assertThat(baseTime.nextAvailableAt(PUBLISH_DELAY_MINUTES))
            .isEqualTo(LocalDateTime.of(2026, 8, 27, 17, 10));
    }

    @Test
    @DisplayName("하루 마지막 회차의 다음 발표는 내일 첫 회차다")
    void nextAvailableAtWrapsToNextDay() {
        KmaBaseTime baseTime = KmaBaseTime.latestAvailable(
            LocalDateTime.of(2026, 8, 27, 23, 30), PUBLISH_DELAY_MINUTES);
        assertThat(baseTime.baseTimeParam()).isEqualTo("2300");

        assertThat(baseTime.nextAvailableAt(PUBLISH_DELAY_MINUTES))
            .isEqualTo(LocalDateTime.of(2026, 8, 28, 2, 10));
    }
}

package com.hondigagae.domainlayer.insight.domain.enums;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 추천 구간이 없을 때 <b>왜</b> 없다고 말하는가.
 *
 * <p>이 판정이 틀리면 화면이 곡선과 다른 말을 한다. 실제로 그랬다 — 풍랑경보가 발효된 날
 * 시간대 곡선에는 저녁 안전 구간이 초록으로 그려져 있는데, 응답이 {@code goldenStart: null}
 * 하나만 주는 바람에 화면은 "남은 시간이 모두 위험 등급이에요"라고 단정했다.
 *
 * <p>시계에 기대지 않으려고 <b>규칙 자체</b>를 여기서 고정한다. 곡선을 실제로 만들어 검증하면
 * 늦은 밤에 결과가 달라져 테스트가 시각을 탄다.
 */
class GoldenWindowStatusTest {

    @Test
    @DisplayName("추천할 구간을 찾았으면 AVAILABLE")
    void availableWhenWindowFound() {
        assertThat(GoldenWindowStatus.of(true, false, true)).isEqualTo(GoldenWindowStatus.AVAILABLE);
        assertThat(GoldenWindowStatus.of(true, false, true).hasWindow()).isTrue();
    }

    @Test
    @DisplayName("남은 시각이 전부 위험일 때만 ALL_HOURS_RISKY - 이 문구만이 판정이다")
    void allHoursRiskyOnlyWhenCurveHasNoAcceptableRun() {
        assertThat(GoldenWindowStatus.of(true, false, false))
            .isEqualTo(GoldenWindowStatus.ALL_HOURS_RISKY);
    }

    @Test
    @DisplayName("경보 중에는 곡선이 좋아도 SUPPRESSED_BY_WARNING - 위험 단정이 아니다")
    void warningSuppressesRatherThanCondemns() {
        // hasWindow 가 무엇이든 결과가 같아야 한다. 경보는 곡선의 내용과 무관하게 추천을 막는다.
        assertThat(GoldenWindowStatus.of(true, true, true))
            .isEqualTo(GoldenWindowStatus.SUPPRESSED_BY_WARNING);
        assertThat(GoldenWindowStatus.of(true, true, false))
            .isEqualTo(GoldenWindowStatus.SUPPRESSED_BY_WARNING);
    }

    @Test
    @DisplayName("곡선이 없으면 무엇보다 먼저 NO_FORECAST - 모르는 것을 나쁜 것으로 말하지 않는다")
    void noForecastWinsOverEverything() {
        for (boolean warningActive : new boolean[] {true, false}) {
            assertThat(GoldenWindowStatus.of(false, warningActive, false))
                .isEqualTo(GoldenWindowStatus.NO_FORECAST);
        }
    }

    @Test
    @DisplayName("추천 구간이 있는 상태는 AVAILABLE 하나뿐이다")
    void onlyAvailableHasWindow() {
        for (GoldenWindowStatus status : GoldenWindowStatus.values()) {
            assertThat(status.hasWindow()).isEqualTo(status == GoldenWindowStatus.AVAILABLE);
        }
    }
}

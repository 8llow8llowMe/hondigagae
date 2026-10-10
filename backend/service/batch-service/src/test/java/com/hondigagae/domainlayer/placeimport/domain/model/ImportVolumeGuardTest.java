package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ImportVolumeGuardTest {

    private static final int MIN_ROWS = 1_200;
    private static final int MAX_ROWS = 20_000;

    @Test
    @DisplayName("하한에 못 미치면 막는다 — 원천 필터가 어긋나 절반만 들어온 상태")
    void blocksTooFewRows() {
        // #726 당시 실제로 들어오던 건수. DelistGuard 는 상대 비교라 이 상태를 통과시켰다.
        assertThat(ImportVolumeGuard.withinRange(880, MIN_ROWS, MAX_ROWS)).isFalse();
        assertThat(ImportVolumeGuard.withinRange(0, MIN_ROWS, MAX_ROWS)).isFalse();
        assertThat(ImportVolumeGuard.withinRange(1_199, MIN_ROWS, MAX_ROWS)).isFalse();
    }

    @Test
    @DisplayName("상한을 넘으면 막는다 — 지역 필터가 풀려 전국이 들어온 상태")
    void blocksTooManyRows() {
        assertThat(ImportVolumeGuard.withinRange(20_001, MIN_ROWS, MAX_ROWS)).isFalse();
        assertThat(ImportVolumeGuard.withinRange(58_000, MIN_ROWS, MAX_ROWS)).isFalse();
    }

    @Test
    @DisplayName("기대 범위 안이면 통과한다 — 경계값 포함")
    void passesWithinRange() {
        assertThat(ImportVolumeGuard.withinRange(MIN_ROWS, MIN_ROWS, MAX_ROWS)).isTrue();
        assertThat(ImportVolumeGuard.withinRange(2_099, MIN_ROWS, MAX_ROWS)).isTrue();
        assertThat(ImportVolumeGuard.withinRange(MAX_ROWS, MIN_ROWS, MAX_ROWS)).isTrue();
    }
}

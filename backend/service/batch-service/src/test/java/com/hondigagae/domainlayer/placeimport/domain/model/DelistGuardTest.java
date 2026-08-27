package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DelistGuardTest {

    @Test
    @DisplayName("적재 0건이면 무조건 막는다 — 원천을 못 읽은 것과 구분할 수 없다")
    void zeroImportIsAlwaysBlocked() {
        assertThat(DelistGuard.allows(0, 0)).isFalse();
        assertThat(DelistGuard.allows(0, 102)).isFalse();
    }

    @Test
    @DisplayName("기존 활성 대비 30% 넘게 줄면 원천 이상으로 보고 막는다")
    void bigDropIsBlocked() {
        // 식약처 102곳이 등록돼 있는데 이번 파일에 71곳뿐 — 경계값 바로 아래
        assertThat(DelistGuard.allows(71, 102)).isFalse();
        assertThat(DelistGuard.allows(30, 102)).isFalse();
    }

    @Test
    @DisplayName("소폭 감소와 증가는 통과한다")
    void normalRunsPass() {
        assertThat(DelistGuard.allows(72, 102)).isTrue();
        assertThat(DelistGuard.allows(102, 102)).isTrue();
        assertThat(DelistGuard.allows(150, 102)).isTrue();
    }

    @Test
    @DisplayName("첫 실행(활성 0건)은 적재가 있기만 하면 통과한다")
    void firstRunPasses() {
        assertThat(DelistGuard.allows(1, 0)).isTrue();
    }
}

package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 기상청 여름철 체감온도 산식 검증. 기대값은 산식(Stull 습구온도 → 체감온도)을 독립 구현으로
 * 계산한 대조값이다 — 이 값들이 어긋나면 계수를 잘못 옮긴 것이다.
 */
class FeelsLikeTemperatureTest {

    @Test
    @DisplayName("기상청 산식 대조값과 일치한다 (폭염특보 척도)")
    void matchesKmaFormula() {
        // 폭염주의보(33℃)·경보(35℃) 기준 근방의 대표 지점들
        assertThat(FeelsLikeTemperature.of(30.0, 70).celsius()).isCloseTo(31.3, within(0.1));
        assertThat(FeelsLikeTemperature.of(30.0, 85).celsius()).isCloseTo(32.5, within(0.1));
        assertThat(FeelsLikeTemperature.of(32.0, 70).celsius()).isCloseTo(33.3, within(0.1));
        assertThat(FeelsLikeTemperature.of(33.0, 80).celsius()).isCloseTo(35.2, within(0.1));
        assertThat(FeelsLikeTemperature.of(34.0, 60).celsius()).isCloseTo(34.5, within(0.1));
    }

    @Test
    @DisplayName("습도가 없으면 보정하지 않고 기온을 그대로 쓴다 — 없는 근거를 지어내지 않는다")
    void missingHumidityKeepsAirTemperature() {
        assertThat(FeelsLikeTemperature.of(31.0, null).celsius()).isEqualTo(31.0);
        assertThat(FeelsLikeTemperature.of(31.0, null).isAdjusted(31.0)).isFalse();
    }

    @Test
    @DisplayName("고온다습에서 체감이 기온보다 높아지고 보정 여부가 구분된다")
    void humidAdjustmentIsVisible() {
        FeelsLikeTemperature humid = FeelsLikeTemperature.of(33.0, 80);
        assertThat(humid.celsius()).isGreaterThan(33.0);
        assertThat(humid.isAdjusted(33.0)).isTrue();
    }
}

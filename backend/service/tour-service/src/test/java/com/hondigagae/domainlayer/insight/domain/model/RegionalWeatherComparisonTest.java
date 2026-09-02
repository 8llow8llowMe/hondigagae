package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.domain.enums.JejuRegion;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 권역 추천 규칙 검증.
 *
 * <p>확인하려는 것은 "가장 높은 점수"가 아니라 <b>고르지 않아야 할 때 고르지 않는가</b>와
 * <b>같은 조건에서 같은 답을 주는가</b>다. 추천은 사용자가 실제로 차를 몰고 가는 근거라
 * 흔들리거나 근거 없이 지목하면 안 된다.
 */
class RegionalWeatherComparisonTest {

    private static final LocalDate DATE = LocalDate.of(2026, 9, 2);

    @Test
    @DisplayName("점수가 가장 높은 권역을 고른다")
    void picksHighestScore() {
        RegionalWeatherComparison comparison = RegionalWeatherComparison.of(DATE, List.of(
            scored(JejuRegion.NORTH, 60),
            scored(JejuRegion.SOUTH, 88),
            scored(JejuRegion.EAST, 71)));

        assertThat(comparison.recommended()).isNotNull();
        assertThat(comparison.recommended().region()).isEqualTo(JejuRegion.SOUTH);
    }

    @Test
    @DisplayName("점수가 매겨진 권역이 하나도 없으면 추천하지 않는다")
    void recommendsNothingWhenNoRegionIsScored() {
        // "그나마 나은 곳"을 억지로 지목하면 근거 없는 추천이 된다.
        RegionalWeatherComparison comparison = RegionalWeatherComparison.of(DATE, List.of(
            unscored(JejuRegion.NORTH), unscored(JejuRegion.SOUTH)));

        assertThat(comparison.recommended()).isNull();
        // 다만 목록에서는 지우지 않는다 - 조회되지 않았다는 사실이 화면에 드러나야 한다.
        assertThat(comparison.regions()).hasSize(2);
    }

    @Test
    @DisplayName("예보를 못 받은 권역은 추천 후보에서만 빠진다")
    void skipsUnscoredRegionsWhenPicking() {
        RegionalWeatherComparison comparison = RegionalWeatherComparison.of(DATE, List.of(
            unscored(JejuRegion.NORTH),
            scored(JejuRegion.SOUTH, 55),
            unscored(JejuRegion.HALLA)));

        assertThat(comparison.recommended().region()).isEqualTo(JejuRegion.SOUTH);
        assertThat(comparison.regions()).hasSize(3);
    }

    @Test
    @DisplayName("동점이면 선언 순서가 앞선 권역을 고른다 — 같은 조건에서 답이 흔들리지 않는다")
    void breaksTieDeterministically() {
        List<RegionWeather> regions = List.of(
            scored(JejuRegion.NORTH, 80),
            scored(JejuRegion.SOUTH, 80),
            scored(JejuRegion.EAST, 80));

        // 같은 입력을 여러 번 넣어도 같은 답이어야 한다.
        assertThat(RegionalWeatherComparison.of(DATE, regions).recommended().region())
            .isEqualTo(JejuRegion.NORTH);
        assertThat(RegionalWeatherComparison.of(DATE, regions).recommended().region())
            .isEqualTo(JejuRegion.NORTH);
    }

    private RegionWeather scored(JejuRegion region, int score) {
        return RegionWeather.builder()
            .region(region).date(DATE).weatherScore(score).reasons(List.of())
            .build();
    }

    private RegionWeather unscored(JejuRegion region) {
        return RegionWeather.builder().region(region).date(DATE).reasons(List.of()).build();
    }
}

package com.hondigagae.domainlayer.placeimport.domain.enums;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 법정동 ↔ 관광 코드 환산 (#726).
 *
 * <p>두 체계를 섞으면 조용히 0건이 오거나 절반만 온다. 숫자를 여기서 못박아 둔다 —
 * 근거는 {@code docs/entity-design.md} 의 place 컬럼 표와 {@code JejuLegalRegion} 이다.
 */
class RegionCodeMappingTest {

    @Test
    @DisplayName("관광 areaCode 39 는 법정동 시도코드 50 이다")
    void mapsAreaCodeToLegalDongRegionCode() {
        assertThat(RegionCodeMapping.toLegalDongRegionCode("39")).isEqualTo("50");
        assertThat(RegionCodeMapping.toLegalDongRegionCode(" 39 ")).isEqualTo("50");
    }

    @Test
    @DisplayName("법정동 시군구코드 110/130 은 관광 시군구코드 4/3 이다")
    void mapsLegalDongSigunguToSigunguCode() {
        assertThat(RegionCodeMapping.toSigunguCodeFromLegalDong("110")).isEqualTo("4");
        assertThat(RegionCodeMapping.toSigunguCodeFromLegalDong("130")).isEqualTo("3");
    }

    @Test
    @DisplayName("모르는 값은 null — 호출부가 조용히 넘기지 않고 막아야 한다")
    void returnsNullForUnknownValues() {
        assertThat(RegionCodeMapping.toLegalDongRegionCode("41")).isNull();
        assertThat(RegionCodeMapping.toLegalDongRegionCode(null)).isNull();
        assertThat(RegionCodeMapping.toSigunguCodeFromLegalDong("999")).isNull();
        assertThat(RegionCodeMapping.toSigunguCodeFromLegalDong(null)).isNull();
    }

    @Test
    @DisplayName("기존 areaCode 판정은 관광 체계 그대로다 — 잡 파라미터와 DB scope 키는 39 다")
    void keepsKnownAreaCodeSemantics() {
        assertThat(RegionCodeMapping.isKnownAreaCode("39")).isTrue();
        // 법정동 코드를 잡 파라미터로 넣으면 여기서 걸러져야 한다.
        assertThat(RegionCodeMapping.isKnownAreaCode("50")).isFalse();
    }
}

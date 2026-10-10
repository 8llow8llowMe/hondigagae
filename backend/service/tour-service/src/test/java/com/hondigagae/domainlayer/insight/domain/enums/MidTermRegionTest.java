package com.hondigagae.domainlayer.insight.domain.enums;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 중기예보 구역 판정.
 *
 * <p>두 오퍼레이션의 코드 체계가 다른 것이 이 연동의 첫 함정이다. 코드를 섞으면 오류가 아니라
 * 조용히 빈 응답이 오므로, 어느 값이 어느 오퍼레이션용인지 테스트로 못박는다.
 */
class MidTermRegionTest {

    @Test
    @DisplayName("육상예보는 도 단위라 두 구역이 같은 코드를 쓴다")
    void landRegionIsProvinceWide() {
        assertThat(MidTermRegion.JEJU_SI.getLandRegId())
            .isEqualTo(MidTermRegion.SEOGWIPO_SI.getLandRegId());
    }

    @Test
    @DisplayName("기온은 지점 단위라 제주시와 서귀포시가 갈린다")
    void temperatureRegionSplitsByCity() {
        assertThat(MidTermRegion.JEJU_SI.getTemperatureRegId())
            .isNotEqualTo(MidTermRegion.SEOGWIPO_SI.getTemperatureRegId());
    }

    @Test
    @DisplayName("시군구코드가 있으면 그것을 우선한다")
    void prefersSigunguCode() {
        // 좌표는 제주시 쪽(북)인데 코드가 서귀포면 코드를 따른다 — 원천이 준 사실이다.
        assertThat(MidTermRegion.of("3", 33.50d)).isEqualTo(MidTermRegion.SEOGWIPO_SI);
        assertThat(MidTermRegion.of("4", 33.20d)).isEqualTo(MidTermRegion.JEJU_SI);
    }

    @Test
    @DisplayName("시군구코드가 없으면 위도로 갈라낸다")
    void fallsBackToLatitude() {
        // 원천마다 시군구 매핑 품질이 달라 비어 있는 행이 실제로 존재한다.
        assertThat(MidTermRegion.of(null, 33.4996d)).isEqualTo(MidTermRegion.JEJU_SI);      // 제주시청
        assertThat(MidTermRegion.of(null, 33.2541d)).isEqualTo(MidTermRegion.SEOGWIPO_SI);  // 서귀포시청
        assertThat(MidTermRegion.of("", 33.2470d)).isEqualTo(MidTermRegion.SEOGWIPO_SI);    // 천지연폭포
    }

    @Test
    @DisplayName("알 수 없는 시군구코드도 위도로 떨어진다")
    void unknownCodeFallsBackToLatitude() {
        assertThat(MidTermRegion.of("99", 33.4580d)).isEqualTo(MidTermRegion.JEJU_SI);      // 성산일출봉
    }

    @Test
    @DisplayName("캐시 키는 두 코드를 함께 담는다")
    void cacheKeyCarriesBothCodes() {
        assertThat(MidTermRegion.JEJU_SI.cacheKey())
            .contains(MidTermRegion.JEJU_SI.getLandRegId())
            .contains(MidTermRegion.JEJU_SI.getTemperatureRegId());
        assertThat(MidTermRegion.JEJU_SI.cacheKey()).isNotEqualTo(MidTermRegion.SEOGWIPO_SI.cacheKey());
    }
}

package com.hondigagae.global.properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.placeimport.domain.model.ImportVolumeGuard;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 적재 건수 가드 경계의 기본값 접힘.
 *
 * <p>배포 값이 늘 숫자 리터럴로 오지 않는다 — compose 의 {@code ${VAR:-}} 는 변수를 빈 문자열로
 * 만들고 그것은 바인딩에서 null 로 떨어진다. 접히지 않으면 하한이 0 이 되어 가드가 아무것도
 * 막지 못하거나, 컨테이너가 기동조차 못 한다 (`CultureFacilityPropertiesTest` 와 같은 함정).
 */
class PlaceImportVolumePropertiesTest {

    @Test
    @DisplayName("값이 없거나 0 이하면 기본 1,680 ~ 4,200 으로 접는다")
    void foldsMissingOrNonPositiveToDefault() {
        PlaceImportVolumeProperties empty = new PlaceImportVolumeProperties(null, null);
        assertThat(empty.minRows()).isEqualTo(1_680);
        assertThat(empty.maxRows()).isEqualTo(4_200);

        PlaceImportVolumeProperties zero = new PlaceImportVolumeProperties(0, -1);
        assertThat(zero.minRows()).isEqualTo(1_680);
        assertThat(zero.maxRows()).isEqualTo(4_200);
    }

    @Test
    @DisplayName("기본 범위는 실측 2,099 를 통과시키고 20% 감소·2배 증가를 잡는다 (#828)")
    void defaultRangeMatchesMeasuredVolume() {
        PlaceImportVolumeProperties defaults = new PlaceImportVolumeProperties(null, null);
        int min = defaults.minRows();
        int max = defaults.maxRows();

        // 2026-09-21 첫 재적재 실측. 이 값이 걸리면 가드가 매 실행 잡을 멈춘다.
        assertThat(ImportVolumeGuard.withinRange(2_099, min, max)).isTrue();
        // #726 의 결함(제주 2,124 중 880건만 들어오던 상태)은 반드시 걸려야 한다.
        assertThat(ImportVolumeGuard.withinRange(880, min, max)).isFalse();
        // 하한 경계 = 실측의 20% 감소선.
        assertThat(ImportVolumeGuard.withinRange(1_680, min, max)).isTrue();
        assertThat(ImportVolumeGuard.withinRange(1_679, min, max)).isFalse();
        // 상한 경계 = 실측의 2배선. 총량이 2~3배로 부푸는 사고를 잡는다.
        assertThat(ImportVolumeGuard.withinRange(4_200, min, max)).isTrue();
        assertThat(ImportVolumeGuard.withinRange(4_201, min, max)).isFalse();
    }

    @Test
    @DisplayName("준 값이 있으면 그대로 쓴다 — 두 번째 실측이 쌓이면 더 조일 수 있어야 한다")
    void keepsGivenValue() {
        PlaceImportVolumeProperties given = new PlaceImportVolumeProperties(1_900, 3_000);

        assertThat(given.minRows()).isEqualTo(1_900);
        assertThat(given.maxRows()).isEqualTo(3_000);
    }

    @Test
    @DisplayName("min >= max 면 기동에서 죽는다 — 뒤집힌 범위는 전량 실행을 매번 실패시킨다")
    void failsFastOnInvertedRange() {
        // 조용히 기본값으로 덮으면 운영자가 준 값이 무시되고, 그대로 두면 withinRange 가 늘
        // false 라 전량 실행과 뒤따르는 스텝이 매주 멈춘다. 설정 오타는 기동에서 죽는 편이 낫다.
        assertThatThrownBy(() -> new PlaceImportVolumeProperties(25_000, 20_000))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("minRows=25000")
            .hasMessageContaining("maxRows=20000");

        assertThatThrownBy(() -> new PlaceImportVolumeProperties(2_000, 2_000))
            .isInstanceOf(IllegalArgumentException.class);
    }
}

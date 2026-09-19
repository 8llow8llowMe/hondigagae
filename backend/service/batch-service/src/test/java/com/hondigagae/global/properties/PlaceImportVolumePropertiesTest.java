package com.hondigagae.global.properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
    @DisplayName("값이 없거나 0 이하면 기본 1,200 ~ 20,000 으로 접는다")
    void foldsMissingOrNonPositiveToDefault() {
        PlaceImportVolumeProperties empty = new PlaceImportVolumeProperties(null, null);
        assertThat(empty.minRows()).isEqualTo(1_200);
        assertThat(empty.maxRows()).isEqualTo(20_000);

        PlaceImportVolumeProperties zero = new PlaceImportVolumeProperties(0, -1);
        assertThat(zero.minRows()).isEqualTo(1_200);
        assertThat(zero.maxRows()).isEqualTo(20_000);
    }

    @Test
    @DisplayName("준 값이 있으면 그대로 쓴다 — 첫 재적재로 실제 건수가 나오면 조일 수 있어야 한다")
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

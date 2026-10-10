package com.hondigagae.global.properties;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 동반 조건 상세 호출 상한의 기본값 접힘 (#877). 이유는 {@link PlaceIntroImportPropertiesTest} 와 같다 —
 * compose 의 {@code ${VAR:-}} 빈 문자열이 null 로 떨어져도 기동이 깨지지 않아야 한다.
 */
class PetTourImportPropertiesTest {

    @Test
    @DisplayName("값이 없거나 0 이하면 기본 350 으로 접는다 — 제주 동반 정보 336건이 한 실행에 든다")
    void foldsMissingOrNonPositiveToDefault() {
        assertThat(new PetTourImportProperties(null).maxCallsPerRun()).isEqualTo(350);
        assertThat(new PetTourImportProperties(0).maxCallsPerRun()).isEqualTo(350);
        assertThat(new PetTourImportProperties(-1).maxCallsPerRun()).isEqualTo(350);
    }

    @Test
    @DisplayName("준 값이 있으면 그대로 쓴다")
    void keepsGivenValue() {
        assertThat(new PetTourImportProperties(40).maxCallsPerRun()).isEqualTo(40);
    }
}

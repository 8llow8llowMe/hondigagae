package com.hondigagae.global.properties;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 실행당 호출 상한의 기본값 접힘.
 *
 * <p>배포 값이 늘 숫자 리터럴로 오지 않는다 — compose 의 {@code ${VAR:-}} 는 변수를 빈 문자열로
 * 만들고 그것은 바인딩에서 null 로 떨어진다. 접히지 않으면 상한이 0 이 되어 스텝이 아무것도
 * 하지 않거나(0 이하), 컨테이너가 기동조차 못 한다 (`CultureFacilityPropertiesTest` 와 같은 함정).
 */
class PlaceIntroImportPropertiesTest {

    @Test
    @DisplayName("값이 없거나 0 이하면 기본 300 으로 접는다")
    void foldsMissingOrNonPositiveToDefault() {
        assertThat(new PlaceIntroImportProperties(null).maxCallsPerRun()).isEqualTo(300);
        assertThat(new PlaceIntroImportProperties(0).maxCallsPerRun()).isEqualTo(300);
        assertThat(new PlaceIntroImportProperties(-1).maxCallsPerRun()).isEqualTo(300);
    }

    @Test
    @DisplayName("준 값이 있으면 그대로 쓴다 — 쿼터 사정에 따라 낮출 수 있어야 한다")
    void keepsGivenValue() {
        assertThat(new PlaceIntroImportProperties(40).maxCallsPerRun()).isEqualTo(40);
    }
}

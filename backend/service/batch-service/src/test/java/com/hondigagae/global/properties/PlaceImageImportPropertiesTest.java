package com.hondigagae.global.properties;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 실행당 호출 상한의 기본값 접힘 (#478).
 *
 * <p>배포 값이 늘 숫자 리터럴로 오지 않는다 — compose 의 {@code ${VAR:-}} 는 변수를 빈 문자열로
 * 만들고 그것은 바인딩에서 null 로 떨어진다. 접히지 않으면 상한이 0 이 되고, 어댑터가 0 이하를
 * 빈 목록으로 접으므로 <b>이미지 스텝이 아무 일도 하지 않은 채 성공으로 끝난다</b> —
 * 커버리지가 조용히 0 이 되는 형태라 가장 늦게 발견된다.
 */
class PlaceImageImportPropertiesTest {

    @Test
    @DisplayName("값이 없거나 0 이하면 기본 400 으로 접는다")
    void foldsMissingOrNonPositiveToDefault() {
        assertThat(new PlaceImageImportProperties(null).maxCallsPerRun()).isEqualTo(400);
        assertThat(new PlaceImageImportProperties(0).maxCallsPerRun()).isEqualTo(400);
        assertThat(new PlaceImageImportProperties(-1).maxCallsPerRun()).isEqualTo(400);
    }

    @Test
    @DisplayName("준 값이 있으면 그대로 쓴다 — 쿼터 사정에 따라 올리고 낮출 수 있어야 한다")
    void keepsGivenValue() {
        assertThat(new PlaceImageImportProperties(40).maxCallsPerRun()).isEqualTo(40);
        assertThat(new PlaceImageImportProperties(1000).maxCallsPerRun()).isEqualTo(1000);
    }
}

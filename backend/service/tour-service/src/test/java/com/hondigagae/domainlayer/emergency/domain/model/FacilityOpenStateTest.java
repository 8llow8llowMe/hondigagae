package com.hondigagae.domainlayer.emergency.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * "지금 영업 중인가" 판정 검증.
 *
 * <p>확인하려는 것은 열림/닫힘이 아니라 <b>모름(null)이 살아 있는가</b>다. 제주 동물병원은
 * 절반이 운영시간을 주지 않는데, 그것을 "닫힘"으로 접으면 급할 때 열려 있는 병원을 화면에서
 * 지우게 된다. 목록과 상세가 이 규칙을 공유하므로 여기서 한 번만 고정한다.
 */
class FacilityOpenStateTest {

    /** 2026-09-02 는 수요일이다. */
    private static final LocalDateTime WEDNESDAY_10AM = LocalDateTime.of(2026, 9, 2, 10, 0);
    private static final LocalDateTime WEDNESDAY_11PM = LocalDateTime.of(2026, 9, 2, 23, 0);

    @Test
    @DisplayName("영업시간 정보가 없고 24시간도 아니면 모름(null)이다")
    void returnsNullWhenNothingIsKnown() {
        // "닫힘"이 아니라 "모름"이어야 한다. 이 구분이 이 규칙의 존재 이유다.
        assertThat(FacilityOpenState.resolve(null, false, WEDNESDAY_10AM)).isNull();
        assertThat(FacilityOpenState.resolve("  ", false, WEDNESDAY_10AM)).isNull();
    }

    @Test
    @DisplayName("영업시간 정보가 없어도 24시간 시설은 열린 것으로 본다")
    void treatsOpen24AsOpenWithoutSpec() {
        // 상호의 "24시"만 보고 open24 가 켜진 곳은 spec 이 없다. 그래도 닫혔다고 하면 안 된다.
        assertThat(FacilityOpenState.resolve(null, true, WEDNESDAY_11PM)).isTrue();
    }

    @Test
    @DisplayName("영업시간 spec 이 있으면 그것으로 판정한다")
    void usesSpecWhenPresent() {
        // 형식은 "요일숫자:HHMM-HHMM" 이다 (수요일=3).
        String spec = "3:0900-1800";

        assertThat(FacilityOpenState.resolve(spec, false, WEDNESDAY_10AM)).isTrue();
        assertThat(FacilityOpenState.resolve(spec, false, WEDNESDAY_11PM)).isFalse();
    }

    @Test
    @DisplayName("spec 이 있으면 open24 보다 spec 이 우선한다")
    void prefersSpecOverOpen24Flag() {
        // open24 는 상호 문자열에서 추정되기도 하는 값이라 spec 보다 근거가 약하다.
        assertThat(FacilityOpenState.resolve("3:0900-1800", true, WEDNESDAY_11PM)).isFalse();
    }
}

package com.hondigagae.domainlayer.place.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 여행 장소 "지금 영업 중인가" 판정 검증.
 *
 * <p>emergency 의 {@code FacilityOpenStateTest} 와 같은 규칙을 고정한다 — 핵심은
 * <b>모름(null)이 살아 있는가</b>다. 운영시간 원문을 못 푼 장소(실측 7%)를 "닫힘"으로
 * 접으면 열려 있는 장소가 화면에서 지워진다.
 */
class PlaceOpenStateTest {

    /** 2026-09-02 는 수요일이다. */
    private static final LocalDateTime WEDNESDAY_10AM = LocalDateTime.of(2026, 9, 2, 10, 0);
    private static final LocalDateTime WEDNESDAY_11PM = LocalDateTime.of(2026, 9, 2, 23, 0);

    @Test
    @DisplayName("영업시간 정보가 없고 24시간도 아니면 모름(null)이다")
    void returnsNullWhenNothingIsKnown() {
        assertThat(PlaceOpenState.resolve(null, false, WEDNESDAY_10AM)).isNull();
        assertThat(PlaceOpenState.resolve("  ", false, WEDNESDAY_10AM)).isNull();
    }

    @Test
    @DisplayName("영업시간 정보가 없어도 24시간 장소는 열린 것으로 본다")
    void treatsOpen24AsOpenWithoutSpec() {
        assertThat(PlaceOpenState.resolve(null, true, WEDNESDAY_11PM)).isTrue();
    }

    @Test
    @DisplayName("영업시간 spec 이 있으면 그것으로 판정한다")
    void usesSpecWhenPresent() {
        // 형식은 "요일숫자:HHMM-HHMM" 이다 (수요일=3).
        String spec = "3:0900-1800";

        assertThat(PlaceOpenState.resolve(spec, false, WEDNESDAY_10AM)).isTrue();
        assertThat(PlaceOpenState.resolve(spec, false, WEDNESDAY_11PM)).isFalse();
    }

    @Test
    @DisplayName("spec 이 있으면 open24 보다 spec 이 우선한다")
    void prefersSpecOverOpen24Flag() {
        assertThat(PlaceOpenState.resolve("3:0900-1800", true, WEDNESDAY_11PM)).isFalse();
    }
}

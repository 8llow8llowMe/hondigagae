package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 문화정보원 실내 · 실외 칸 → place.indoor · outdoor 규칙 (#1434).
 *
 * <p>조합은 제주 여행 카테고리 중복 제거 후 실측 분포다 — (실내, 실외, 동반) = (N,N,N) 59 · (N,Y,Y) 83 · (Y,N,Y) 9 · (Y,Y,Y) 77.
 */
class PetStayAreaTest {

    @Test
    @DisplayName("동반 불가 행은 실내외를 모른다 — 실내 · 실외 칸은 반려견이 머물 곳이지 시설 형태가 아니다")
    void notAllowedRowsAreUnknown() {
        // (N,N,N) 59곳 — 박물관 · 미술관 · 문예회관 · 펜션. 예전에는 실내 박물관이 화면에 '야외' 로 나왔다
        assertThat(PetStayArea.fromCultureColumns(false, "N", "N")).isEqualTo(PetStayArea.UNKNOWN);
        // 실측에는 없지만 동반 N 이면 칸 값과 무관하게 모름이다
        assertThat(PetStayArea.fromCultureColumns(false, "Y", "N")).isEqualTo(PetStayArea.UNKNOWN);
        assertThat(PetStayArea.fromCultureColumns(false, "N", "Y")).isEqualTo(PetStayArea.UNKNOWN);
        assertThat(PetStayArea.fromCultureColumns(false, "Y", "Y")).isEqualTo(PetStayArea.UNKNOWN);
    }

    @Test
    @DisplayName("동반 가능 행은 Y/N 을 그대로 옮긴다")
    void allowedRowsCarryYn() {
        // (N,Y,Y) 83 — 박물관 17곳은 제한사항 "야외만 반려동물 동반 가능" (제주항일기념관 '야외' 는 반려견 기준으로 맞다)
        assertThat(PetStayArea.fromCultureColumns(true, "N", "Y")).isEqualTo(new PetStayArea(false, true));
        // (Y,N,Y) 9 카페
        assertThat(PetStayArea.fromCultureColumns(true, "Y", "N")).isEqualTo(new PetStayArea(true, false));
        // (Y,Y,Y) 77 — 한림공원 · 스누피가든 · 펜션 · 카페
        assertThat(PetStayArea.fromCultureColumns(true, "Y", "Y")).isEqualTo(new PetStayArea(true, true));
        // 대소문자 · 공백은 기존 Y/N 파서와 같이 흡수한다
        assertThat(PetStayArea.fromCultureColumns(true, " y ", "n")).isEqualTo(new PetStayArea(true, false));
    }

    @Test
    @DisplayName("동반 가능인데 두 칸이 모두 N 이거나 비어 있으면 모름이다 — 머물 곳이 없다는 말은 시설 형태를 알려 주지 않는다")
    void allowedRowWithoutAnyStayAreaIsUnknown() {
        assertThat(PetStayArea.fromCultureColumns(true, "N", "N")).isEqualTo(PetStayArea.UNKNOWN);
        assertThat(PetStayArea.fromCultureColumns(true, null, null)).isEqualTo(PetStayArea.UNKNOWN);
        assertThat(PetStayArea.fromCultureColumns(true, "", "N")).isEqualTo(PetStayArea.UNKNOWN);
    }
}

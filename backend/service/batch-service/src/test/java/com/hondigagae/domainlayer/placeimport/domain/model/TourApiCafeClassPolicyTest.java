package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 관광정보 API 분류 코드로 카페를 가리는 규칙 (#1473). 코드는 2026-10-14 {@code lclsSystmCode2} · {@code categoryCode2} 실조회 값이다.
 */
class TourApiCafeClassPolicyTest {

    @Test
    @DisplayName("신분류 중분류가 FD05(카페/찻집)면 카페다 — 구분류 cat3 가 비어 있어도(dev 295곳) 신분류로 잡는다")
    void classifiesByLclsSystm2() {
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("FD05", null)).isEqualTo("카페");
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("FD05", "A05020100")).isEqualTo("카페");
    }

    @Test
    @DisplayName("신분류가 없을 때만 구분류 A05020900(카페/전통찻집)으로 대신 판정한다 — dev 0곳이라 방어용이다")
    void fallsBackToCat3OnlyWithoutLclsSystm2() {
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf(null, "A05020900")).isEqualTo("카페");
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("", "A05020900")).isEqualTo("카페");
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("  ", "A05020900")).isEqualTo("카페");
    }

    /**
     * dev 실측(2026-10-14): cat3 = A05020900 인데 lclsSystm2 가 FD05 가 아닌 행 6곳이 <b>전부</b> lclsSystm3 = FD030100(제과)다 — 베카신 ·
     * 봉주르마담 · 블루메베이글 · 수와래베이커리 · 시스터필드 · 아베베베이커리. 구분류 시절 카페/전통찻집이던 베이커리 카페가 신분류에서 제과로 옮겨졌다.
     */
    @Test
    @DisplayName("신분류가 있으면 신분류가 이긴다 — 구분류가 카페여도 신분류가 FD05 가 아니면 카페가 아니다(구분류 카페 · 신분류 제과 6곳)")
    void lclsSystm2WinsOverCat3() {
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("FD03", "A05020900")).isNull();
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("FD01", "A05020900")).isNull();
    }

    @Test
    @DisplayName("판정은 중분류 lclsSystm2 로만 한다 — 소분류 FD050100 이 lclsSystm2 자리에 와도 앞자리로 넘겨짚지 않는다")
    void matchesWholeMiddleClassCodeOnly() {
        // 런북 SQL(lcls_systm2 = 'FD05')과 같은 결과여야 하므로 앞자리 일치로 넓히지 않는다
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("FD050100", null)).isNull();
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf(null, "A050209")).isNull();
    }

    @Test
    @DisplayName("카페가 아닌 음식 분류는 원천 분류를 싣지 않는다(null) — 한식 · 외국식 · 간이음식(제과 포함) · 주점")
    void leavesOtherFoodClassesNull() {
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("FD01", "A05020100")).isNull();
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("FD02", null)).isNull();
        // 제과(FD030100)는 카페로 묶지 않는다 — FE 카페 칩이 '카페' 정확 일치라 섞으면 칩 결과가 바뀐다
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("FD03", null)).isNull();
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("FD04", null)).isNull();
    }

    @Test
    @DisplayName("두 코드가 모두 없으면 null 이다 — 모르는 값을 지어내지 않는다")
    void leavesNullWithoutCodes() {
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf(null, null)).isNull();
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("", "")).isNull();
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("  ", " ")).isNull();
    }

    @Test
    @DisplayName("대소문자는 무시한다 — DB 콜레이션(_ci)과 같다. 앞뒤 공백도 무시하지만 SQL 은 콜레이션에 따라 달라 런북 1-3 이 0건인지 막는다")
    void ignoresSurroundingBlanksAndCase() {
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf(" FD05 ", null)).isEqualTo("카페");
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("fd05", null)).isEqualTo("카페");
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf(null, "a05020900 ")).isEqualTo("카페");
    }

    @Test
    @DisplayName("싣는 값은 식약처 카페 규칙과 같은 상수다 — 서비스 사이 값 계약 '카페' 는 한 곳에 둔다")
    void sharesCafeCategoryWithNamePolicy() {
        assertThat(TourApiCafeClassPolicy.sourceCategoryOf("FD05", null)).isSameAs(CafeNamePolicy.CAFE_CATEGORY);
    }
}

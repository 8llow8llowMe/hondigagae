package com.hondigagae.domainlayer.placeimport.domain.model;

import java.util.Locale;

/**
 * 관광정보 API(TourAPI) 행 중 분류 코드가 카페인 곳을 원천 분류 '카페' 로 적재하는 규칙 (#1473).
 *
 * <p>화면의 카페 칩 · 핀 · 배지와 장소 검색의 {@code sourceCategory=카페} 는 모두 {@code place.source_category} 하나만 본다. 관광정보
 * 음식점(contentTypeId 39) 행은 그 칸이 비어 있어서 이름에 단서가 없는 카페(델문도 · 우유부단 · 나비정원 · 와랑와랑)가 식사로 저장되고
 * 지도 핀도 수저였다. 원천은 이미 분류 코드를 준다 — 이름이 유일한 신호인 식약처({@link CafeNamePolicy})와 달리 <b>추측이 필요 없다.</b>
 *
 * <p><b>신분류가 정본이다.</b>
 * <ul>
 *   <li>신분류 중분류 {@code lclsSystm2 = FD05}(카페/ 찻집 — FD050100 카페 · FD050200 찻집 · FD050300 기타음료점)면 카페다.</li>
 *   <li><b>신분류가 없을(null · 공백) 때만</b> 구분류 소분류 {@code cat3 = A05020900}(카페/전통찻집)으로 대신 판정한다.</li>
 * </ul>
 * 구분류가 신분류를 이기게 두면 제과가 카페로 실린다. dev 실측(2026-10-14)에서 {@code cat3 = A05020900} 인데 신분류가 FD05 가 아닌 행 6곳이
 * <b>전부</b> {@code lclsSystm3 = FD030100}(제과)였다 — 베카신 · 봉주르마담 · 블루메베이글 · 수와래베이커리 · 시스터필드 · 아베베베이커리. 구분류
 * 시절 카페/전통찻집이던 베이커리 카페가 신분류에서 제과로 옮겨진 것이다. 신분류는 관광정보 음식점 전부에 있고 신분류 없이 구분류만 카페인 행은
 * dev 0곳이라, 구분류 판정은 <b>방어용</b>이다.
 *
 * <p>코드는 대소문자를 가리지 않고(DB 콜레이션 {@code _ci} 와 같다) <b>통째로</b> 맞춘다 — 기존 행을 고치는 런북 SQL과 같은 결과여야 하므로
 * 앞자리 일치로 넓히지 않는다. 앞뒤 공백도 무시하는데 SQL 쪽은 콜레이션에 따라 달라, 런북이 공백 붙은 코드가 0건인지 먼저 센다.
 *
 * <p><b>카페가 아니면 원천 분류를 싣지 않는다(null).</b> 한식 · 외국식 · 주점을 옮겨 적을 소비자가 아직 없다. 특히 <b>제과(FD030100)는 카페로
 * 묶지 않는다</b> — FE 카페 칩은 '카페' 정확 일치라 제과를 섞으면 칩 결과가 바뀌고, 식사 판정 쪽의 제과는 FE 이름 낱말 규칙이 이미 덮는다.
 */
public final class TourApiCafeClassPolicy {

    /** 신분류(lclsSystm) 중분류 카페/ 찻집. */
    public static final String CAFE_LCLS_SYSTM2 = "FD05";

    /** 구분류(cat) 소분류 카페/전통찻집. 신분류가 없을 때만 본다. */
    public static final String CAFE_CAT3 = "A05020900";

    private TourApiCafeClassPolicy() {
    }

    /**
     * 관광정보 행의 원천 분류. 분류 코드가 카페면 {@link CafeNamePolicy#CAFE_CATEGORY}, 아니면 null 이다.
     *
     * @param lclsSystm2 신분류 중분류 코드 (예: FD05). 있으면 이 값만 본다
     * @param cat3       구분류 소분류 코드 (예: A05020900). 신분류가 없을 때만 본다
     */
    public static String sourceCategoryOf(String lclsSystm2, String cat3) {
        return isCafe(lclsSystm2, cat3) ? CafeNamePolicy.CAFE_CATEGORY : null;
    }

    /** 신분류가 있으면 신분류로, 없으면 구분류로 카페인지 판정한다. */
    public static boolean isCafe(String lclsSystm2, String cat3) {
        if (lclsSystm2 != null && !lclsSystm2.isBlank()) {
            return matches(lclsSystm2, CAFE_LCLS_SYSTM2);
        }
        return matches(cat3, CAFE_CAT3);
    }

    private static boolean matches(String code, String expected) {
        return code != null && code.strip().toUpperCase(Locale.ROOT).equals(expected);
    }
}

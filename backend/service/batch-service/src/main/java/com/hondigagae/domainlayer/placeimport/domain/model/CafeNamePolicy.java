package com.hondigagae.domainlayer.placeimport.domain.model;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

/**
 * 식약처 휴게음식점 중 이름이 카페인 곳을 원천 분류 '카페' 로 적재하는 규칙 (#1434).
 *
 * <p>식약처 xlsx 는 연번 · 업소명 · 업종 · 지역 · 업소주소뿐이라 <b>이름이 유일한 신호</b>다. 업종 '휴게음식점' 을 그대로 실으면
 * 화면의 카페 라벨 · 카페 필터 · AI 일정의 카페 요청이 모두 {@code sourceCategory = 카페} 만 보므로 커피빈제주애월DT점 같은 곳이
 * 카페로 잡히지 않았다.
 *
 * <ul>
 *   <li><b>업종이 휴게음식점인 행에만</b> 적용한다. 일반음식점 · 제과점영업은 이름에 '카페' 가 있어도 원래 업종이다.</li>
 *   <li>이름 정규화는 공백 제거 · 소문자(NFC)다. 키워드는 부분 문자열로 본다.</li>
 *   <li>키워드는 일반 낱말({@link #GENERIC_KEYWORDS})과 이름에 '커피' 가 없는 주요 커피 체인({@link #CHAIN_KEYWORDS})이다.</li>
 * </ul>
 *
 * <p><b>한계.</b> 부분 문자열이라 '다방' 이 낱말 속에 든 이름(예: '바다방갈로')도 카페가 된다. 반대로 신호가 없는 카페
 * ('해피라떼클럽' · '고양이있어요')는 휴게음식점으로 남는다. 체인 목록은 한국어 상호만 본다(영문 상호의 체인명은 잡지 않는다).
 * 2026-08 고정물 기준 제주 휴게음식점 38곳 중 9곳이 카페가 된다.
 */
public final class CafeNamePolicy {

    /** 카페로 적재할 원천 분류. FE 카페 라벨 · 카페 필터 · AI 카페 요청이 이 값을 본다. */
    public static final String CAFE_CATEGORY = "카페";

    /** 이 규칙을 적용하는 식약처 업종. */
    public static final String REST_FOOD_BUSINESS_TYPE = "휴게음식점";

    private static final List<String> GENERIC_KEYWORDS = List.of("카페", "커피", "coffee", "cafe", "café", "다방");

    /** 이름에 '커피' 가 없는 커피 체인 위주. '커피' 가 든 체인(컴포즈커피 · 메가커피 등)은 일반 낱말이 이미 잡는다. */
    private static final List<String> CHAIN_KEYWORDS = List.of(
        "스타벅스", "커피빈", "투썸", "이디야", "메가엠지씨", "메가커피", "빽다방", "할리스", "폴바셋", "탐앤탐스", "엔제리너스", "파스쿠찌",
        "컴포즈", "블루보틀", "테라로사", "더벤티", "매머드", "바나프레소", "드롭탑");

    private CafeNamePolicy() {
    }

    /**
     * 식약처 행의 원천 분류. 휴게음식점이면서 이름이 카페면 {@link #CAFE_CATEGORY}, 아니면 원래 업종 문자열 그대로다.
     *
     * @param businessType 식약처 업종 원문 (일반음식점 / 휴게음식점 / 제과점영업)
     * @param name         업소명
     */
    public static String sourceCategoryOf(String businessType, String name) {
        if (businessType == null || !REST_FOOD_BUSINESS_TYPE.equals(normalize(businessType))) {
            return businessType;
        }
        return looksLikeCafe(name) ? CAFE_CATEGORY : businessType;
    }

    /** 정규화한 이름에 카페 키워드가 들어 있는지. 빈 이름은 아니다. */
    public static boolean looksLikeCafe(String name) {
        String normalized = normalize(name);
        if (normalized.isEmpty()) {
            return false;
        }
        return GENERIC_KEYWORDS.stream().anyMatch(normalized::contains) || CHAIN_KEYWORDS.stream().anyMatch(normalized::contains);
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        String composed = Normalizer.normalize(value, Normalizer.Form.NFC);
        return composed.replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
    }
}

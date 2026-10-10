package com.hondigagae.domainlayer.placeimport.domain.enums;

import java.util.Map;

/**
 * 문화정보원 카테고리3 → 관광 API contentTypeId 매핑.
 *
 * <p>두 원천을 한 테이블에 담으므로 분류 체계를 관광 API 쪽으로 맞춘다.
 * 매핑에 없는 값(동물약국·동물병원·미용 등 의료·서비스 계열)은 여행 코스 대상이 아니므로
 * {@link #NOT_TRAVEL} 를 돌려주고 적재에서 제외한다. 동물병원은 별도 emergency 컨텍스트가 다룬다.
 */
public final class CultureCategoryMapping {

    /** 여행 코스 대상이 아님을 뜻하는 값. */
    public static final String NOT_TRAVEL = null;

    private static final Map<String, String> CATEGORY_TO_CONTENT_TYPE = Map.ofEntries(
        Map.entry("여행지", "12"),
        Map.entry("공원", "12"),
        Map.entry("박물관", "14"),
        Map.entry("미술관", "14"),
        Map.entry("문예회관", "14"),
        Map.entry("캠핑장", "28"),
        Map.entry("펜션", "32"),
        Map.entry("호텔", "32"),
        Map.entry("리조트", "32"),
        Map.entry("카페", "39")
    );

    private CultureCategoryMapping() {
    }

    public static String toContentTypeId(String category3) {
        if (category3 == null) {
            return NOT_TRAVEL;
        }
        return CATEGORY_TO_CONTENT_TYPE.get(category3.trim());
    }

    public static boolean isTravelCategory(String category3) {
        return toContentTypeId(category3) != null;
    }
}

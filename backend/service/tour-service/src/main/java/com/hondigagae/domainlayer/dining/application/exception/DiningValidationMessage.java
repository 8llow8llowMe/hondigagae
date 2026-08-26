package com.hondigagae.domainlayer.dining.application.exception;

/**
 * 주변 검색 요청 검증 메시지 카탈로그 (DINING_1xx).
 * 형식은 {@code "코드:사용자 메시지"} — ValidationErrorSupport 가 접두어를 분리한다.
 */
public final class DiningValidationMessage {

    public static final String LAT_REQUIRED = "DINING_101:위도는 필수입니다.";
    public static final String LNG_REQUIRED = "DINING_102:경도는 필수입니다.";
    public static final String LAT_RANGE_INVALID = "DINING_103:위도는 -90 이상 90 이하만 가능합니다.";
    public static final String LNG_RANGE_INVALID = "DINING_104:경도는 -180 이상 180 이하만 가능합니다.";
    public static final String RADIUS_RANGE_INVALID = "DINING_105:검색 반경은 1m 이상 20000m 이하만 가능합니다.";
    public static final String SIZE_RANGE_INVALID = "DINING_106:조회 개수는 1 이상 15 이하만 가능합니다.";

    private DiningValidationMessage() {
    }
}

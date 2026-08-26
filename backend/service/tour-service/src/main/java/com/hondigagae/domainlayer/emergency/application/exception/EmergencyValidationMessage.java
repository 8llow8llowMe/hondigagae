package com.hondigagae.domainlayer.emergency.application.exception;

/**
 * 긴급 시설 조회 검증 메시지 카탈로그 (EMERGENCY_1xx).
 * 형식은 {@code "코드:사용자 메시지"} — ValidationErrorSupport 가 접두어를 분리한다.
 */
public final class EmergencyValidationMessage {

    public static final String LAT_RANGE_INVALID = "EMERGENCY_101:위도는 -90 이상 90 이하만 가능합니다.";
    public static final String LNG_RANGE_INVALID = "EMERGENCY_102:경도는 -180 이상 180 이하만 가능합니다.";
    public static final String RADIUS_RANGE_INVALID = "EMERGENCY_103:검색 반경은 1m 이상 50000m 이하만 가능합니다.";
    public static final String SIZE_RANGE_INVALID = "EMERGENCY_104:조회 개수는 1 이상 50 이하만 가능합니다.";

    private EmergencyValidationMessage() {
    }
}

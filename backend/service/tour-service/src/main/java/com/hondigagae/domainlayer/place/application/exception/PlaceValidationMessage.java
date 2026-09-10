package com.hondigagae.domainlayer.place.application.exception;

public final class PlaceValidationMessage {

    public static final String SIZE_POSITIVE = "PLACE_101:size는 1 이상이어야 합니다.";
    public static final String SIZE_MAX_INVALID = "PLACE_102:size는 50 이하만 가능합니다.";
    public static final String LAT_RANGE_INVALID = "PLACE_103:위도는 -90 이상 90 이하만 가능합니다.";
    public static final String LNG_RANGE_INVALID = "PLACE_104:경도는 -180 이상 180 이하만 가능합니다.";
    public static final String RADIUS_RANGE_INVALID = "PLACE_105:검색 반경은 1m 이상 50000m 이하만 가능합니다.";
    public static final String PET_WEIGHT_RANGE_INVALID = "PLACE_106:반려견 체중은 1kg 이상 100kg 이하만 가능합니다.";
    public static final String KEYWORD_MAX_INVALID = "PLACE_107:keyword는 50자 이하만 가능합니다.";

    private PlaceValidationMessage() {
    }
}

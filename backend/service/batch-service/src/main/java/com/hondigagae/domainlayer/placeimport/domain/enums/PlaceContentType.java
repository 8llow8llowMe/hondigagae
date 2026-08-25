package com.hondigagae.domainlayer.placeimport.domain.enums;

import java.util.Arrays;
import java.util.List;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * TourAPI contentTypeId 구분.
 * 축제(15)는 기간 한정 데이터라 기본 적재 대상에서 제외한다.
 */
@Getter
@RequiredArgsConstructor
public enum PlaceContentType {

    TOURIST_SPOT("12", "관광지"),
    CULTURE("14", "문화시설"),
    FESTIVAL("15", "축제공연행사"),
    COURSE("25", "여행코스"),
    LEPORTS("28", "레포츠"),
    LODGING("32", "숙박"),
    SHOPPING("38", "쇼핑"),
    RESTAURANT("39", "음식점");

    private final String code;
    private final String displayName;

    public static final List<PlaceContentType> DEFAULT_IMPORT_TARGETS = List.of(
        TOURIST_SPOT, CULTURE, COURSE, LEPORTS, LODGING, SHOPPING, RESTAURANT
    );

    public static PlaceContentType fromCode(String code) {
        return Arrays.stream(values())
            .filter(type -> type.code.equals(code))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unknown contentTypeId: " + code));
    }
}

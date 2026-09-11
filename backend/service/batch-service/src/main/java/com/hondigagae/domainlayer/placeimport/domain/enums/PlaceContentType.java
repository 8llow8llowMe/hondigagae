package com.hondigagae.domainlayer.placeimport.domain.enums;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
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

    /**
     * detailIntro2 에 <b>운영시간 필드가 있는</b> 타입. 상세 소개 적재 대상이다.
     *
     * <p>적재 대상 7종 중 셋을 뺐다 — 숙박(32)은 체크인/체크아웃만 있고 운영시간 필드가 없고,
     * 여행코스(25)는 코스 거리·소요시간만 주며, 축제(15)는 애초에 기본 적재 대상이 아니다
     * (기간 한정 데이터). detailIntro2 쿼터가 희소하므로 얻을 것이 없는 호출은 하지 않는다.
     */
    public static final List<PlaceContentType> INTRO_HOURS_TARGETS = List.of(
        TOURIST_SPOT, CULTURE, LEPORTS, SHOPPING, RESTAURANT
    );

    /** 모르는 코드를 예외 없이 다루고 싶은 호출부용. 원천이 준 코드를 그대로 들고 오는 경로에서 쓴다. */
    public static Optional<PlaceContentType> findByCode(String code) {
        return Arrays.stream(values())
            .filter(type -> type.code.equals(code))
            .findFirst();
    }

    public static PlaceContentType fromCode(String code) {
        return findByCode(code)
            .orElseThrow(() -> new IllegalArgumentException("Unknown contentTypeId: " + code));
    }
}

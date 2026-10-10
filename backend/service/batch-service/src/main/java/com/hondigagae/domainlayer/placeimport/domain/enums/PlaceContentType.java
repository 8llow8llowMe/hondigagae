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

    /**
     * 전량 적재 대상. 축제(15)는 기간 한정 데이터라 뺀다.
     *
     * <p><b>{@link #COURSE}(25)는 늘 0건인데도 일부러 남겨 둔 것이다 — 죽은 설정이 아니다.</b>
     * 제주 여행코스는 원천에 없다({@code areaCode=39}·{@code lDongRegnCd=50} 양쪽 모두
     * totalCount=0, 2026-09-19 실측). 빼면 콜 하나와 로그 한 줄을 아끼지만, <b>원천에 제주
     * 여행코스가 생기는 날 아무도 모르게 된다.</b> TourAPI 가 이번에 지역코드를 말없이 바꾼
     * 것처럼(#726) 원천은 조용히 움직이므로 0건이 영구 사실이라고 볼 근거가 없다.
     *
     * <p>남겨 두어도 기존 행이 위험하지 않다 — 0건인 타입은 {@code DelistProcessor} 가 delist
     * 범위에서 자동으로 뺀다 (#726).
     */
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

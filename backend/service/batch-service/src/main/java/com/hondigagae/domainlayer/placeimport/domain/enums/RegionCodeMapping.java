package com.hondigagae.domainlayer.placeimport.domain.enums;

import java.util.Map;

/**
 * 시도·시군구 명칭 → 관광 API 지역 코드 매핑.
 *
 * <p>문화정보원 데이터는 코드가 아니라 명칭으로 지역을 주는데, place 테이블의 지역 컬럼은
 * 관광 API 코드 체계다. 두 원천을 같은 필터로 조회하려면 여기서 코드로 맞춰야 한다.
 *
 * <p>제주만 우선 채운다. 다른 시도로 서비스가 넓어지면 그때 추가한다 — 지금 전국을 채우면
 * 검증되지 않은 매핑이 코드에 남는다.
 */
public final class RegionCodeMapping {

    /** 관광 API areaCode. 제주=39 (법정동 코드 50 과 다르다) */
    private static final Map<String, String> SIDO_TO_AREA_CODE = Map.of(
        "제주특별자치도", "39"
    );

    /**
     * 원천이 쓰는 짧은 지역명 → 시도 명칭.
     *
     * <p>식약처 원천은 "제주"처럼 줄여 쓴다. 이 매핑이 어댑터 안에 사본으로 있으면 지역이
     * 늘어날 때 한쪽만 고치게 되므로 지역 지식은 여기 한곳에 모은다.
     */
    private static final Map<String, String> SHORT_NAME_TO_SIDO = Map.of(
        "제주", "제주특별자치도"
    );

    /** 관광 API sigunguCode. 제주 기준 제주시=4, 서귀포시=3 */
    private static final Map<String, String> SIGUNGU_TO_CODE = Map.of(
        "제주시", "4",
        "서귀포시", "3"
    );

    private RegionCodeMapping() {
    }

    /** 짧은 지역명("제주")을 시도 명칭으로 편다. 모르는 이름이면 null 이다. */
    public static String toSidoName(String shortRegionName) {
        return shortRegionName == null ? null : SHORT_NAME_TO_SIDO.get(shortRegionName.trim());
    }

    public static String toAreaCode(String sidoName) {
        return sidoName == null ? null : SIDO_TO_AREA_CODE.get(sidoName.trim());
    }

    public static String toSigunguCode(String sigunguName) {
        return sigunguName == null ? null : SIGUNGU_TO_CODE.get(sigunguName.trim());
    }

    /**
     * 주소 문자열에서 시군구 코드를 읽는다.
     *
     * <p>식약처 원천은 시군구를 따로 주지 않고 전체 주소만 준다. 제주는 시군구가 둘뿐이라
     * 주소에 이름이 들어 있는지로 판정할 수 있다. 시군구가 많은 시도로 넓힐 때는
     * 이 방식으로는 부족하니 지오코딩 결과의 정제 주소를 쓰도록 바꿔야 한다.
     */
    public static String toSigunguCodeFromAddress(String address) {
        if (address == null) {
            return null;
        }
        for (Map.Entry<String, String> entry : SIGUNGU_TO_CODE.entrySet()) {
            if (address.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        return null;
    }
}

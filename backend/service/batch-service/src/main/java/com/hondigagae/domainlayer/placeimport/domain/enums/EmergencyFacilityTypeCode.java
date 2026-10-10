package com.hondigagae.domainlayer.placeimport.domain.enums;

import java.util.Map;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 긴급 시설 종류. tour-service 의 {@code EmergencyFacilityType} 과 코드 문자열을 맞춘다.
 *
 * <p>문화정보원 카테고리3 값에서 온다. 매핑에 없는 분류는 긴급 시설이 아니다.
 */
@Getter
@RequiredArgsConstructor
public enum EmergencyFacilityTypeCode {

    ANIMAL_HOSPITAL("동물병원"),
    ANIMAL_PHARMACY("동물약국");

    private static final Map<String, EmergencyFacilityTypeCode> BY_CATEGORY = Map.of(
        "동물병원", ANIMAL_HOSPITAL,
        "동물약국", ANIMAL_PHARMACY
    );

    private final String sourceCategory;

    /** 매핑에 없으면 null — 긴급 시설이 아니라는 뜻이다. */
    public static EmergencyFacilityTypeCode fromCategory(String category3) {
        return category3 == null ? null : BY_CATEGORY.get(category3.trim());
    }
}

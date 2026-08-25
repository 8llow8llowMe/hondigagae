package com.hondigagae.domainlayer.place.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 반려동물 동반 구분 (detailPetTour2 원문을 배치 적재 시 가공한 값).
 */
@Getter
@RequiredArgsConstructor
public enum PetAllowanceType {

    ALLOWED("동반 가능", "반려동물 동반이 가능한 장소입니다."),
    PARTIALLY_ALLOWED("부분 동반 가능", "일부 구역 또는 조건부로 반려동물 동반이 가능한 장소입니다."),
    NOT_ALLOWED("동반 불가", "반려동물 동반이 불가능한 장소입니다."),
    UNKNOWN("정보 없음", "반려동물 동반 가능 여부 정보가 확인되지 않은 장소입니다.");

    private final String displayName;
    private final String description;
}

package com.hondigagae.domainlayer.place.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 반려동물 동반 가능 구역 (acmpyTypeCd 원문 가공).
 */
@Getter
@RequiredArgsConstructor
public enum PetAllowanceScope {

    FULL_AREA("전구역 동반 가능", "실내외 전 구역에서 반려동물 동반이 가능합니다."),
    PARTIAL("일부 구역 동반 가능", "지정된 일부 구역에서만 반려동물 동반이 가능합니다."),
    OUTDOOR_ONLY("실외만 동반 가능", "실외 공간에서만 반려동물 동반이 가능합니다."),
    UNKNOWN("정보 없음", "동반 가능 구역 정보가 확인되지 않았습니다.");

    private final String displayName;
    private final String description;
}

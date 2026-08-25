package com.hondigagae.domainlayer.place.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 동반 가능 반려견 크기 (acmpyPsblCpam 원문 가공).
 */
@Getter
@RequiredArgsConstructor
public enum AllowedPetSize {

    ALL("전 견종 가능", "견종·크기 제한 없이 동반이 가능합니다."),
    SMALL_ONLY("소형견만 가능", "소형견만 동반이 가능합니다."),
    SMALL_MEDIUM("중소형견 가능", "소형견과 중형견까지 동반이 가능합니다."),
    UNKNOWN("정보 없음", "동반 가능 크기 정보가 확인되지 않았습니다.");

    private final String displayName;
    private final String description;
}

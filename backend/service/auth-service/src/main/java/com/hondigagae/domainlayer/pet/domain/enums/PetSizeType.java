package com.hondigagae.domainlayer.pet.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 반려견 크기 구분. 장소의 동반 가능 조건(소형견만 허용 등)과 대조하는 데 쓰인다.
 */
@Getter
@RequiredArgsConstructor
public enum PetSizeType {

    SMALL("소형견", "체중 10kg 미만"),
    MEDIUM("중형견", "체중 10kg 이상 25kg 미만"),
    LARGE("대형견", "체중 25kg 이상");

    private final String displayName;
    private final String description;
}

package com.hondigagae.shared.travel.place;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 반려동물 동반 구분 (detailPetTour2 원문을 배치 적재 시 가공한 값).
 *
 * <p>원천이 셋(관광 API / 문화정보원 / 식약처)이라 판정 기준이 갈리지 않게 enum 하나로 모은다.
 * 식약처 등록 업소는 제도가 전구역/일부구역을 나누지 않아 전부 {@link #ALLOWED} 다.
 */
@Getter
@RequiredArgsConstructor
public enum PetAllowanceType implements CodeNameDescribable {

    ALLOWED("동반 가능", "반려동물 동반이 가능한 장소입니다."),
    PARTIALLY_ALLOWED("부분 동반 가능", "일부 구역 또는 조건부로 반려동물 동반이 가능한 장소입니다."),
    NOT_ALLOWED("동반 불가", "반려동물 동반이 불가능한 장소입니다."),
    UNKNOWN("정보 없음", "반려동물 동반 가능 여부 정보가 확인되지 않은 장소입니다.");

    private final String displayName;
    private final String description;

    public boolean isAllowed() {
        return this == ALLOWED;
    }

    public boolean isBlocked() {
        return this == NOT_ALLOWED;
    }
}

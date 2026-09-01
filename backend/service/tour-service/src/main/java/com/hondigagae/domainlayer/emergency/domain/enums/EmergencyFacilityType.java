package com.hondigagae.domainlayer.emergency.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 긴급 시설 종류.
 *
 * <p>여행 중 반려견에게 문제가 생겼을 때 필요한 곳을 한 테이블에 모은다. 급할 때 필요한 것은
 * "가장 가까운 도움"이지 "가장 가까운 병원"이 아니라, 종류를 나눠 두고 거리로 함께 정렬한다.
 */
@Getter
@RequiredArgsConstructor
public enum EmergencyFacilityType implements CodeNameDescribable {

    ANIMAL_HOSPITAL("동물병원", "진료가 필요한 상황에서 찾는 곳입니다."),
    ANIMAL_PHARMACY("동물약국", "상비약이나 처방약이 필요할 때 찾는 곳입니다.");

    private final String displayName;
    private final String description;
}

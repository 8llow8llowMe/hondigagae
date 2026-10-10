package com.hondigagae.domainlayer.emergency.application.info;

import com.hondigagae.domainlayer.emergency.domain.enums.EmergencyFacilityType;
import lombok.Builder;

/**
 * 긴급 시설 상세.
 *
 * <p>{@code NearbyFacilityInfo} 와 달리 거리가 없다 - 상세는 검색 중심점 없이 부른다.
 */
@Builder
public record EmergencyFacilityDetailInfo(
    long facilityId,
    EmergencyFacilityType facilityType,
    String name,
    String addr,
    double lat,
    double lng,
    String tel,
    // 원천이 정보를 주지 않은 경우가 절반이라 null 이 정상값이다.
    String operatingHours,
    String restDate,
    boolean open24,
    // 지금 영업 중인가. null 이면 영업시간을 몰라 판정할 수 없는 곳이다 — "닫힘"과 다르다.
    Boolean openNow
) {

}

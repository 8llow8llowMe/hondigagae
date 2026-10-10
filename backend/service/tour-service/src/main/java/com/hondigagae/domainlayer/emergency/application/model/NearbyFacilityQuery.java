package com.hondigagae.domainlayer.emergency.application.model;

import com.hondigagae.domainlayer.emergency.domain.enums.EmergencyFacilityType;
import lombok.Builder;

@Builder
public record NearbyFacilityQuery(
    double lat,
    double lng,
    int radius,
    // null 이면 종류를 가리지 않는다 — 급할 때는 병원이든 약국이든 가까운 순으로 본다.
    EmergencyFacilityType facilityType,
    // true 면 24시간 운영으로 확인된 곳만 본다.
    boolean open24Only,
    // true 면 지금 영업 중으로 확인된 곳만 본다. 영업시간을 모르는 곳도 빠진다.
    boolean openNowOnly,
    int size
) {

}

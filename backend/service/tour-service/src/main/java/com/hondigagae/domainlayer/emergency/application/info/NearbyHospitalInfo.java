package com.hondigagae.domainlayer.emergency.application.info;

import lombok.Builder;

@Builder
public record NearbyHospitalInfo(
    long hospitalId,
    String name,
    String addr,
    double lat,
    double lng,
    String tel,
    // 원천이 정보를 주지 않은 경우가 절반이라 null 이 정상값이다.
    String operatingHours,
    String restDate,
    boolean open24,
    int distanceMeters
) {

}

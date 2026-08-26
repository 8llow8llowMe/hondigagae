package com.hondigagae.domainlayer.emergency.application.model;

import lombok.Builder;

@Builder
public record NearbyHospitalQuery(
    double lat,
    double lng,
    int radius,
    // true 면 24시간 운영으로 확인된 곳만 본다.
    boolean open24Only,
    int size
) {

}

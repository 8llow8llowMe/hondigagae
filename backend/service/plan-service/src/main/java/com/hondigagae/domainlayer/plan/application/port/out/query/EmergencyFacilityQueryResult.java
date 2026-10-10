package com.hondigagae.domainlayer.plan.application.port.out.query;

import lombok.Builder;

@Builder
public record EmergencyFacilityQueryResult(
    String name,
    String typeName,
    String addr,
    String tel,
    int distanceMeters,
    boolean open24,
    boolean operatingHoursKnown
) {

}

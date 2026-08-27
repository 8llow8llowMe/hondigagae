package com.hondigagae.domainlayer.emergency.application.port.out.query;

import com.hondigagae.domainlayer.emergency.domain.enums.EmergencyFacilityType;
import java.math.BigDecimal;
import lombok.Builder;

@Builder
public record EmergencyFacilityQueryResult(
    long facilityId,
    EmergencyFacilityType facilityType,
    String name,
    String addr,
    BigDecimal lat,
    BigDecimal lng,
    String tel,
    String operatingHours,
    String weeklyHoursSpec,
    String restDate,
    boolean open24
) {

}

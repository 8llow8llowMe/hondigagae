package com.hondigagae.domainlayer.emergency.application.port.out.query;

import java.math.BigDecimal;
import lombok.Builder;

@Builder
public record AnimalHospitalQueryResult(
    long hospitalId,
    String name,
    String addr,
    BigDecimal lat,
    BigDecimal lng,
    String tel,
    String operatingHours,
    String restDate,
    boolean open24
) {

}

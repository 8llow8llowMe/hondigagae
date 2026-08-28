package com.hondigagae.domainlayer.plan.application.port.out.query;

import lombok.Builder;

@Builder
public record PlanPlacePointQueryResult(
    long placeId,
    String title,
    double lat,
    double lng
) {

}

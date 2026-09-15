package com.hondigagae.domainlayer.plan.application.info;

import lombok.Builder;

@Builder
public record PlanReviewItemInfo(
    long reviewItemId,
    long planItemId,
    Long placeId,
    String title,
    int rating,
    String comment,
    int sortOrder
) {

}

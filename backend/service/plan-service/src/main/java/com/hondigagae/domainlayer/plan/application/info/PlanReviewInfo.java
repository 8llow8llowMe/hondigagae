package com.hondigagae.domainlayer.plan.application.info;

import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;

@Builder
public record PlanReviewInfo(
    long reviewId,
    long planId,
    int overallRating,
    String body,
    List<PlanReviewItemInfo> items,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {

}

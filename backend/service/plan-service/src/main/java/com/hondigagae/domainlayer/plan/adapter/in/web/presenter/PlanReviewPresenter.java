package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanReviewPlaceItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanReviewResponse;
import com.hondigagae.domainlayer.plan.application.info.PlanReviewInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanReviewItemInfo;
import org.springframework.stereotype.Component;

@Component
public class PlanReviewPresenter {

    public PlanReviewResponse toResponse(PlanReviewInfo info) {
        return PlanReviewResponse.builder()
            .reviewId(String.valueOf(info.reviewId()))
            .planId(String.valueOf(info.planId()))
            .overallRating(info.overallRating())
            .body(info.body())
            .items(info.items().stream().map(this::toPlaceItem).toList())
            .createdAt(info.createdAt())
            .updatedAt(info.updatedAt())
            .build();
    }

    private PlanReviewPlaceItem toPlaceItem(PlanReviewItemInfo info) {
        return PlanReviewPlaceItem.builder()
            // Snowflake 아이디는 문자열로 내린다 (coding-conventions §7-1).
            .reviewItemId(String.valueOf(info.reviewItemId()))
            .planItemId(String.valueOf(info.planItemId()))
            .placeId(info.placeId() == null ? null : String.valueOf(info.placeId()))
            .title(info.title())
            .rating(info.rating())
            .comment(info.comment())
            .build();
    }
}

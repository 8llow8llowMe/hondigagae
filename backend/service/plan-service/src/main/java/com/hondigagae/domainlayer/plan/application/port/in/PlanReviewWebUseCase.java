package com.hondigagae.domainlayer.plan.application.port.in;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanReviewResponse;
import com.hondigagae.domainlayer.plan.application.command.PlanReviewCommand;

public interface PlanReviewWebUseCase {

    PlanReviewResponse getReview(long memberId, long planId);

    PlanReviewResponse createReview(long memberId, long planId, PlanReviewCommand command);

    PlanReviewResponse updateReview(long memberId, long planId, PlanReviewCommand command);
}

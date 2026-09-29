package com.hondigagae.domainlayer.plan.application.port.in;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanReviewResponse;
import com.hondigagae.domainlayer.plan.application.command.PlanReviewCommand;

public interface PlanReviewWebUseCase {

    /**
     * 일정에 쓴 후기.
     *
     * @return 후기. <b>아직 쓰지 않았으면 {@code null}</b> 이다 — 오류가 아니라 정상 상태라
     *         200 + {@code dataBody} null 로 나간다 (#979). 일정이 없거나 남의 것이면 {@code PLAN_001} 404 를 던진다
     */
    PlanReviewResponse getReview(long memberId, long planId);

    PlanReviewResponse createReview(long memberId, long planId, PlanReviewCommand command);

    PlanReviewResponse updateReview(long memberId, long planId, PlanReviewCommand command);
}

package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.domain.model.PlanReviewItem;
import java.util.List;

public interface PlanReviewItemRepositoryPort {

    List<PlanReviewItem> findByReviewId(long reviewId);

    List<PlanReviewItem> saveAll(List<PlanReviewItem> items);

    void deleteByReviewId(long reviewId);
}

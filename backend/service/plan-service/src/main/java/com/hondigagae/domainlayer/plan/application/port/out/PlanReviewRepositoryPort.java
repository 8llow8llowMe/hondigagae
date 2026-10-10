package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.domain.model.PlanReview;
import java.util.Optional;

public interface PlanReviewRepositoryPort {

    Optional<PlanReview> findByPlanId(long planId);

    boolean existsByPlanId(long planId);

    PlanReview save(PlanReview review);
}

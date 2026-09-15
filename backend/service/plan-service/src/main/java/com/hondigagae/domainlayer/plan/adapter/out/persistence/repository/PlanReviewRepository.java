package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanReviewEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlanReviewRepository extends JpaRepository<PlanReviewEntity, Long> {

    Optional<PlanReviewEntity> findByPlanId(Long planId);

    boolean existsByPlanId(Long planId);
}

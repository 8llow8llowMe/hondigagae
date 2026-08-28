package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.domain.model.Plan;
import java.util.Optional;
import org.springframework.data.domain.Slice;

public interface PlanRepositoryPort {

    Plan save(Plan plan);

    Optional<Plan> findActiveById(long planId);

    /** petId 가 null 이 아니면 그 반려견과 함께한 일정만 — 반려견별 여행 히스토리다. */
    Slice<Plan> findMyPlans(long memberId, Long petId, long lastPlanId, int size);
}

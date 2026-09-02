package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.domain.model.Plan;
import java.util.Optional;
import org.springframework.data.domain.Slice;

public interface PlanRepositoryPort {

    Plan save(Plan plan);

    Optional<Plan> findActiveById(long planId);

    /** petId 가 null 이 아니면 그 반려견이 동행한 일정만 — 여러 마리 중 한 마리로 들어 있어도 히트다 (반려견별 여행 히스토리). */
    Slice<Plan> findMyPlans(long memberId, Long petId, long lastPlanId, int size);
}

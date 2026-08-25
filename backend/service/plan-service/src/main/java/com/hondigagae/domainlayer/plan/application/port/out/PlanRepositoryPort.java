package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.domain.model.Plan;
import java.util.Optional;
import org.springframework.data.domain.Slice;

public interface PlanRepositoryPort {

    Plan save(Plan plan);

    Optional<Plan> findActiveById(long planId);

    Slice<Plan> findMyPlans(long memberId, long lastPlanId, int size);
}

package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import java.util.List;
import java.util.Optional;

public interface PlanItemRepositoryPort {

    List<PlanItem> saveAll(List<PlanItem> items);

    List<PlanItem> findByPlanId(long planId);

    Optional<PlanItem> findById(long planItemId);

    PlanItem save(PlanItem item);

    void deleteByPlanIdAndDay(long planId, int day);
}

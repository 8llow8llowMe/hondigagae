package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import java.util.List;

public interface PlanItemRepositoryPort {

    List<PlanItem> saveAll(List<PlanItem> items);

    List<PlanItem> findByPlanId(long planId);

    void deleteByPlanIdAndDay(long planId, int day);

    void deleteByPlanId(long planId);
}

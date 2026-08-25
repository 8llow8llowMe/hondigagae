package com.hondigagae.domainlayer.plan.adapter.out.persistence;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.repository.PlanItemRepository;
import com.hondigagae.domainlayer.plan.application.mapper.PlanMapper;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlanItemRepositoryAdapter implements PlanItemRepositoryPort {

    private final PlanItemRepository planItemRepository;
    private final PlanMapper planMapper;

    @Override
    public List<PlanItem> saveAll(List<PlanItem> items) {
        return planMapper.toItemDomainListFromEntityList(
            planItemRepository.saveAll(planMapper.toItemEntityListFromDomainList(items)));
    }

    @Override
    public List<PlanItem> findByPlanId(long planId) {
        return planMapper.toItemDomainListFromEntityList(planItemRepository.findByPlanIdOrderByDayAscSequenceAsc(planId));
    }

    @Override
    public void deleteByPlanIdAndDay(long planId, int day) {
        planItemRepository.deleteByPlanIdAndDay(planId, day);
    }

    @Override
    public void deleteByPlanId(long planId) {
        planItemRepository.deleteByPlanId(planId);
    }
}

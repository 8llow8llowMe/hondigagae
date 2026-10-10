package com.hondigagae.domainlayer.plan.adapter.out.persistence;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.repository.PlanPetConditionRepository;
import com.hondigagae.domainlayer.plan.application.mapper.PlanMapper;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetConditionRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.model.PlanPetCondition;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlanPetConditionRepositoryAdapter implements PlanPetConditionRepositoryPort {

    private final PlanPetConditionRepository planPetConditionRepository;
    private final PlanMapper planMapper;

    @Override
    public List<PlanPetCondition> saveAll(List<PlanPetCondition> conditions) {
        return planMapper.toPetConditionDomainListFromEntityList(
            planPetConditionRepository.saveAll(planMapper.toPetConditionEntityListFromDomainList(conditions)));
    }

    @Override
    public List<PlanPetCondition> findByPlanId(long planId) {
        return planMapper.toPetConditionDomainListFromEntityList(
            planPetConditionRepository.findByPlanIdOrderByIdAsc(planId));
    }

    @Override
    public void deleteByPlanId(long planId) {
        planPetConditionRepository.deleteByPlanId(planId);
    }
}

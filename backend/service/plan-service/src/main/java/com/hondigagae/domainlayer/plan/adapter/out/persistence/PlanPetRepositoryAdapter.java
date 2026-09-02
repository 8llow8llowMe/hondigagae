package com.hondigagae.domainlayer.plan.adapter.out.persistence;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.repository.PlanPetRepository;
import com.hondigagae.domainlayer.plan.application.mapper.PlanMapper;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.model.PlanPet;
import java.util.Collection;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlanPetRepositoryAdapter implements PlanPetRepositoryPort {

    private final PlanPetRepository planPetRepository;
    private final PlanMapper planMapper;

    @Override
    public List<PlanPet> saveAll(List<PlanPet> pets) {
        return planMapper.toPetDomainListFromEntityList(
            planPetRepository.saveAll(planMapper.toPetEntityListFromDomainList(pets)));
    }

    @Override
    public List<PlanPet> findByPlanId(long planId) {
        return planMapper.toPetDomainListFromEntityList(planPetRepository.findByPlanIdOrderByIdAsc(planId));
    }

    @Override
    public List<PlanPet> findByPlanIds(Collection<Long> planIds) {
        if (planIds.isEmpty()) {
            return List.of();
        }
        return planMapper.toPetDomainListFromEntityList(planPetRepository.findByPlanIdInOrderByIdAsc(planIds));
    }
}

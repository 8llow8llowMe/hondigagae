package com.hondigagae.domainlayer.plan.adapter.out.persistence;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.repository.PlanRepository;
import com.hondigagae.domainlayer.plan.application.mapper.PlanMapper;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlanRepositoryAdapter implements PlanRepositoryPort {

    private final PlanRepository planRepository;
    private final PlanMapper planMapper;

    @Override
    public Plan save(Plan plan) {
        return planMapper.toDomainFromEntity(planRepository.save(planMapper.toEntityFromDomain(plan)));
    }

    @Override
    public Optional<Plan> findActiveById(long planId) {
        return planRepository.findByIdAndDeletedFalse(planId).map(planMapper::toDomainFromEntity);
    }

    @Override
    public Slice<Plan> findMyPlans(long memberId, Long petId, long lastPlanId, int size) {
        if (petId == null) {
            return planRepository.findByMemberIdAndDeletedFalseAndIdLessThanOrderByIdDesc(
                    memberId, lastPlanId, PageRequest.of(0, size))
                .map(planMapper::toDomainFromEntity);
        }
        return planRepository.findByMemberIdAndPetIdAndDeletedFalseAndIdLessThanOrderByIdDesc(
                memberId, petId, lastPlanId, PageRequest.of(0, size))
            .map(planMapper::toDomainFromEntity);
    }
}

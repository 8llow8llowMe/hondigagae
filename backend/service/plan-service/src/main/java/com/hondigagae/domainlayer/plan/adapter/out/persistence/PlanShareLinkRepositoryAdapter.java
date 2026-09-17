package com.hondigagae.domainlayer.plan.adapter.out.persistence;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.repository.PlanShareLinkRepository;
import com.hondigagae.domainlayer.plan.application.mapper.PlanMapper;
import com.hondigagae.domainlayer.plan.application.port.out.PlanShareLinkRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.model.PlanShareLink;
import java.time.LocalDateTime;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlanShareLinkRepositoryAdapter implements PlanShareLinkRepositoryPort {

    private final PlanShareLinkRepository planShareLinkRepository;
    private final PlanMapper planMapper;

    @Override
    public PlanShareLink save(PlanShareLink shareLink) {
        return planMapper.toDomainFromEntity(
            planShareLinkRepository.save(planMapper.toEntityFromDomain(shareLink)));
    }

    @Override
    public Optional<PlanShareLink> findByToken(String token) {
        return planShareLinkRepository.findByToken(token).map(planMapper::toDomainFromEntity);
    }

    @Override
    public Optional<PlanShareLink> findValidByPlanId(long planId, LocalDateTime now) {
        return planShareLinkRepository
            .findFirstByPlanIdAndRevokedAtIsNullAndExpiresAtAfterOrderByIdDesc(planId, now)
            .map(planMapper::toDomainFromEntity);
    }

    @Override
    public int revokeActiveByPlanId(long planId, LocalDateTime revokedAt) {
        return planShareLinkRepository.revokeActiveByPlanId(planId, revokedAt);
    }
}

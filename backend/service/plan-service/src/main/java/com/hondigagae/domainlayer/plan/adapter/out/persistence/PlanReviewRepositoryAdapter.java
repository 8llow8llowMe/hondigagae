package com.hondigagae.domainlayer.plan.adapter.out.persistence;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.repository.PlanReviewRepository;
import com.hondigagae.domainlayer.plan.application.mapper.PlanMapper;
import com.hondigagae.domainlayer.plan.application.port.out.PlanReviewRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.model.PlanReview;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlanReviewRepositoryAdapter implements PlanReviewRepositoryPort {

    private final PlanReviewRepository planReviewRepository;
    private final PlanMapper planMapper;

    @Override
    public Optional<PlanReview> findByPlanId(long planId) {
        return planReviewRepository.findByPlanId(planId).map(planMapper::toDomainFromEntity);
    }

    @Override
    public boolean existsByPlanId(long planId) {
        return planReviewRepository.existsByPlanId(planId);
    }

    /**
     * 저장하면서 flush 한다. 그냥 {@code save} 이면 INSERT 가 커밋 시점까지 밀려
     * {@code uk_plan_review_plan_id} 위반이 Processor 의 {@code try} 밖에서 터진다 —
     * 409 로 바꾸려던 예외가 그대로 500 으로 나간다.
     */
    @Override
    public PlanReview save(PlanReview review) {
        return planMapper.toDomainFromEntity(
            planReviewRepository.saveAndFlush(planMapper.toEntityFromDomain(review)));
    }
}

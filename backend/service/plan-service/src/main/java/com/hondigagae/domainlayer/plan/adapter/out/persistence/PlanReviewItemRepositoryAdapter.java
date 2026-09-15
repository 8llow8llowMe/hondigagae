package com.hondigagae.domainlayer.plan.adapter.out.persistence;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.repository.PlanReviewItemRepository;
import com.hondigagae.domainlayer.plan.application.mapper.PlanMapper;
import com.hondigagae.domainlayer.plan.application.port.out.PlanReviewItemRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.model.PlanReviewItem;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlanReviewItemRepositoryAdapter implements PlanReviewItemRepositoryPort {

    private final PlanReviewItemRepository planReviewItemRepository;
    private final PlanMapper planMapper;

    @Override
    public List<PlanReviewItem> findByReviewId(long reviewId) {
        return planMapper.toReviewItemDomainListFromEntityList(
            planReviewItemRepository.findByReviewIdOrderBySortOrderAscIdAsc(reviewId));
    }

    /**
     * 저장하면서 flush 한다. PUT 교체 직후 같은 (reviewId, planItemId) 위반이
     * Processor 구간 안에서 잡혀야 한다.
     */
    @Override
    public List<PlanReviewItem> saveAll(List<PlanReviewItem> items) {
        return planMapper.toReviewItemDomainListFromEntityList(
            planReviewItemRepository.saveAllAndFlush(planMapper.toReviewItemEntityListFromDomainList(items)));
    }

    @Override
    public void deleteByReviewId(long reviewId) {
        planReviewItemRepository.deleteByReviewId(reviewId);
    }
}

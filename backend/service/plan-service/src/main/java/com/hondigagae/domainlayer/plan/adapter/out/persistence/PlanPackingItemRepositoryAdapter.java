package com.hondigagae.domainlayer.plan.adapter.out.persistence;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.repository.PlanPackingItemRepository;
import com.hondigagae.domainlayer.plan.application.mapper.PlanMapper;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPackingItemRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.enums.PackingItemSource;
import com.hondigagae.domainlayer.plan.domain.model.PlanPackingItem;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlanPackingItemRepositoryAdapter implements PlanPackingItemRepositoryPort {

    private final PlanPackingItemRepository planPackingItemRepository;
    private final PlanMapper planMapper;

    /**
     * <b>저장하면서 flush 한다.</b> 그냥 {@code saveAll} 이면 INSERT 가 커밋 시점까지 밀려
     * {@code uk_plan_packing_item_plan_id_name} 위반이 Processor 의 {@code try} 밖에서 터진다 —
     * 409 로 바꾸려던 예외가 그대로 500 으로 나간다. 트랜잭션 끝에서 어차피 나갈 쓰기라 비용도 없다.
     */
    @Override
    public List<PlanPackingItem> saveAll(List<PlanPackingItem> items) {
        return planMapper.toPackingDomainListFromEntityList(
            planPackingItemRepository.saveAllAndFlush(planMapper.toPackingEntityListFromDomainList(items)));
    }

    @Override
    public List<PlanPackingItem> findByPlanId(long planId) {
        return planMapper.toPackingDomainListFromEntityList(
            planPackingItemRepository.findByPlanIdOrderBySortOrderAscIdAsc(planId));
    }

    @Override
    public Optional<PlanPackingItem> findById(long packingItemId) {
        return planPackingItemRepository.findById(packingItemId).map(planMapper::toDomainFromEntity);
    }

    /** 단건 저장도 같은 이유로 flush 한다 — 유니크 인덱스 위반이 저장 구간 안에서 잡혀야 409 가 된다. */
    @Override
    public PlanPackingItem save(PlanPackingItem item) {
        return planMapper.toDomainFromEntity(
            planPackingItemRepository.saveAndFlush(planMapper.toEntityFromDomain(item)));
    }

    @Override
    public void deleteByPlanIdAndSource(long planId, PackingItemSource source) {
        planPackingItemRepository.deleteByPlanIdAndSource(planId, source);
    }

    @Override
    public void deleteByPlanIdAndId(long planId, long packingItemId) {
        planPackingItemRepository.deleteByPlanIdAndId(planId, packingItemId);
    }
}

package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.domain.enums.PackingItemSource;
import com.hondigagae.domainlayer.plan.domain.model.PlanPackingItem;
import java.util.List;
import java.util.Optional;

public interface PlanPackingItemRepositoryPort {

    List<PlanPackingItem> saveAll(List<PlanPackingItem> items);

    /**
     * 정렬은 {@code sortOrder} 오름차순, 같으면 아이디 오름차순으로 고정한다 — 표시 순서를 화면이
     * 다시 정하지 않고, tie-break 이 없으면 같은 목록이 요청마다 다른 순서로 나올 수 있다.
     */
    List<PlanPackingItem> findByPlanId(long planId);

    Optional<PlanPackingItem> findById(long packingItemId);

    PlanPackingItem save(PlanPackingItem item);

    void deleteByPlanIdAndSource(long planId, PackingItemSource source);

    void deleteByPlanIdAndId(long planId, long packingItemId);
}

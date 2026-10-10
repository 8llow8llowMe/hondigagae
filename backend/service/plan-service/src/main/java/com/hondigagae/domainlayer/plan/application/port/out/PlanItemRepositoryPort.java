package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.application.port.out.query.PlanItemCountQueryResult;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PlanItemRepositoryPort {

    List<PlanItem> saveAll(List<PlanItem> items);

    List<PlanItem> findByPlanId(long planId);

    Optional<PlanItem> findById(long planItemId);

    PlanItem save(PlanItem item);

    void deleteByPlanIdAndDay(long planId, int day);

    /**
     * 목록 화면용 벌크 집계 — 일정마다 따로 세면 페이지 크기만큼 왕복한다 (coding-conventions §9-7).
     * 항목이 하나도 없는 일정은 결과에 행이 없다.
     */
    List<PlanItemCountQueryResult> countByPlanIds(Collection<Long> planIds);
}

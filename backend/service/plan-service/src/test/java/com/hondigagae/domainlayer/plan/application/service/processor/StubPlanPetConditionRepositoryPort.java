package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.port.out.PlanPetConditionRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.model.PlanPetCondition;
import java.util.ArrayList;
import java.util.List;

/**
 * 완료 시점 반려견 특성 스냅샷 스텁 (#629).
 *
 * <p>여러 테스트가 같은 포트를 쓰므로 한 곳에 둔다 — 파일마다 복제하면 "다시 완료하면 지우고
 * 다시 찍는다" 같은 규칙이 스텁마다 달라진다.
 */
class StubPlanPetConditionRepositoryPort implements PlanPetConditionRepositoryPort {

    final List<PlanPetCondition> stored = new ArrayList<>();
    int deleteCalls;

    @Override
    public List<PlanPetCondition> saveAll(List<PlanPetCondition> conditions) {
        stored.addAll(conditions);
        return conditions;
    }

    @Override
    public List<PlanPetCondition> findByPlanId(long planId) {
        return stored.stream().filter(condition -> condition.planId() == planId).toList();
    }

    @Override
    public void deleteByPlanId(long planId) {
        deleteCalls++;
        stored.removeIf(condition -> condition.planId() == planId);
    }
}

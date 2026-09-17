package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.domain.model.PlanPetCondition;
import java.util.List;

/**
 * 일정 완료 시점 반려견 특성 스냅샷 저장소 계약.
 *
 * <p>조회 결과가 비어 있을 수 있다 — 이 테이블이 생기기 전에 완료된 일정이다. 그때는
 * 예전처럼 auth-service 를 읽는다. 없는 스냅샷을 지어내지 않는다.
 */
public interface PlanPetConditionRepositoryPort {

    List<PlanPetCondition> saveAll(List<PlanPetCondition> conditions);

    List<PlanPetCondition> findByPlanId(long planId);

    /** 다시 완료할 때 옛 스냅샷을 걷는다. */
    void deleteByPlanId(long planId);
}

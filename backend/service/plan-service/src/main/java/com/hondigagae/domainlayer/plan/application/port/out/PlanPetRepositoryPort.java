package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.domain.model.PlanPet;
import java.util.Collection;
import java.util.List;

/**
 * 일정 동행 반려견 저장소 계약.
 *
 * <p>조회 결과가 비어 있을 수 있다 — 조인 테이블이 생기기 전의 일정이다. 그 해석
 * ({@code plan.petId} 한 마리로 읽는다)은 도메인({@code Plan.resolvePetIds})이 갖고,
 * 이 포트는 저장된 그대로만 돌려준다.
 */
public interface PlanPetRepositoryPort {

    List<PlanPet> saveAll(List<PlanPet> pets);

    /** 저장 순서대로. 첫 번째가 대표 반려견이다. */
    List<PlanPet> findByPlanId(long planId);

    /** 목록 화면용 벌크 조회 — 일정마다 따로 부르면 페이지 크기만큼 왕복한다 (coding-conventions §9-7). */
    List<PlanPet> findByPlanIds(Collection<Long> planIds);

    /** 동행견 교체용. 지운 뒤 새로 넣는다. */
    void deleteByPlanId(long planId);
}

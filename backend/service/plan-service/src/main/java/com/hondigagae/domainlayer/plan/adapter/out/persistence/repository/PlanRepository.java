package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanEntity;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PlanRepository extends JpaRepository<PlanEntity, Long> {

    Optional<PlanEntity> findByIdAndDeletedFalse(Long id);

    Slice<PlanEntity> findByMemberIdAndDeletedFalseAndIdLessThanOrderByIdDesc(Long memberId, Long lastPlanId, Pageable pageable);

    /**
     * 반려견별 여행 히스토리 — <b>동행 목록에 한 마리라도 들어 있으면 히트</b>다.
     *
     * <p>조인 테이블(plan_pet)과 대표 컬럼(plan.pet_id)을 함께 본다. 조인 테이블이 생기기 전의
     * 일정은 plan_pet 에 행이 없어 대표 컬럼으로만 찾을 수 있고, 새 일정의 두 번째 이후 반려견은
     * 조인 테이블로만 찾을 수 있다. 어느 한쪽만 보면 옛 일정 또는 동행견이 히스토리에서 빠진다.
     * or-null 조건 대신 메서드를 나눈다 (coding-conventions 쿼리 규칙).
     */
    @Query("""
        select p from PlanEntity p
        where p.memberId = :memberId
          and p.deleted = false
          and p.id < :lastPlanId
          and (p.petId = :petId
               or p.id in (select pp.planId from PlanPetEntity pp where pp.petId = :petId))
        order by p.id desc
        """)
    Slice<PlanEntity> findMyPlansWithPet(Long memberId, Long petId, Long lastPlanId, Pageable pageable);
}

package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanPetEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PlanPetRepository extends JpaRepository<PlanPetEntity, Long> {

    /** id 오름차순 = 저장 순서. 첫 행이 대표 반려견({@code plan.pet_id})과 같다. */
    List<PlanPetEntity> findByPlanIdOrderByIdAsc(Long planId);

    List<PlanPetEntity> findByPlanIdInOrderByIdAsc(Collection<Long> planIds);

    /**
     * 벌크 DML 로 <b>즉시</b> 지운다. 파생 delete 는 {@code em.remove} 큐잉이라 flush 때
     * INSERT 가 DELETE 보다 먼저 나가는데, 동행견 교체는 같은 (planId, petId) 를 재사용하므로
     * (예: [1, 2] → [2, 3]) 옛 행이 남은 채 INSERT 되어
     * uk_plan_pet_plan_id_pet_id 위반으로 죽는다 — 일자 항목 교체와 같은 함정이다.
     */
    @Modifying
    @Query("delete from PlanPetEntity pet where pet.planId = :planId")
    void deleteByPlanId(Long planId);
}

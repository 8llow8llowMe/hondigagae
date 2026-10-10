package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanPetConditionEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PlanPetConditionRepository extends JpaRepository<PlanPetConditionEntity, Long> {

    List<PlanPetConditionEntity> findByPlanIdOrderByIdAsc(Long planId);

    /**
     * 벌크 DML 로 <b>즉시</b> 지운다. 파생 delete 는 {@code em.remove} 큐잉이라 flush 때
     * INSERT 가 DELETE 보다 먼저 나가는데, 다시 완료하는 경로는 같은 (planId, petId) 를
     * 재사용하므로 옛 행이 남은 채 INSERT 되어 uk_plan_pet_condition_plan_id_pet_id 위반으로
     * 죽는다 - plan_pet·plan_item 이 겪은 것과 같은 함정이다.
     */
    @Modifying
    @Query("delete from PlanPetConditionEntity condition where condition.planId = :planId")
    void deleteByPlanId(Long planId);
}

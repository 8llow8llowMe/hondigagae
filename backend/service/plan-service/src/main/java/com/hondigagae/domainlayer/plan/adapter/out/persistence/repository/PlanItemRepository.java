package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanItemEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PlanItemRepository extends JpaRepository<PlanItemEntity, Long> {

    List<PlanItemEntity> findByPlanIdOrderByDayAscSequenceAsc(Long planId);

    /**
     * 벌크 DML 로 <b>즉시</b> 지운다. 파생 delete 는 {@code em.remove} 큐잉이라 flush 때
     * INSERT 가 DELETE 보다 먼저 나가는데, 일자 교체는 같은 (planId, day, sequence) 를
     * 재사용하므로 옛 행이 남은 채 INSERT 되어 uk_plan_item_plan_id_day_sequence 위반으로 죽는다.
     */
    @Modifying
    @Query("delete from PlanItemEntity item where item.planId = :planId and item.day = :day")
    void deleteByPlanIdAndDay(Long planId, int day);
}

package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanItemEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlanItemRepository extends JpaRepository<PlanItemEntity, Long> {

    List<PlanItemEntity> findByPlanIdOrderByDayAscSequenceAsc(Long planId);

    void deleteByPlanIdAndDay(Long planId, int day);
}

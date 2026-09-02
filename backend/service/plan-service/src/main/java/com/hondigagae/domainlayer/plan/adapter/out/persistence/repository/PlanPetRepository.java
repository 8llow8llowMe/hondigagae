package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanPetEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlanPetRepository extends JpaRepository<PlanPetEntity, Long> {

    /** id 오름차순 = 저장 순서. 첫 행이 대표 반려견({@code plan.pet_id})과 같다. */
    List<PlanPetEntity> findByPlanIdOrderByIdAsc(Long planId);

    List<PlanPetEntity> findByPlanIdInOrderByIdAsc(Collection<Long> planIds);
}

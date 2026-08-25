package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanEntity;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlanRepository extends JpaRepository<PlanEntity, Long> {

    Optional<PlanEntity> findByIdAndDeletedFalse(Long id);

    Slice<PlanEntity> findByMemberIdAndDeletedFalseAndIdLessThanOrderByIdDesc(Long memberId, Long lastPlanId, Pageable pageable);
}

package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanSummaryInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlanQueryProcessor {

    private final PlanRepositoryPort planRepositoryPort;
    private final PlanItemRepositoryPort planItemRepositoryPort;

    /**
     * 본인 소유의 활성 일정을 조회한다.
     * 타인 소유 일정은 존재 자체를 노출하지 않기 위해 동일하게 404 로 처리한다.
     */
    public Plan getOwnedPlan(long memberId, long planId) {
        return planRepositoryPort.findActiveById(planId)
            .filter(plan -> plan.isOwnedBy(memberId))
            .orElseThrow(() -> new PlanException(PlanErrorCode.NOT_FOUND_PLAN));
    }

    public PlanInfo getPlanInfo(Plan plan) {
        List<PlanItemInfo> items = planItemRepositoryPort.findByPlanId(plan.id()).stream()
            .map(this::toItemInfo)
            .toList();

        return PlanInfo.builder()
            .planId(plan.id())
            .petId(plan.petId())
            .areaCode(plan.areaCode())
            .sigunguCode(plan.sigunguCode())
            .title(plan.title())
            .startDate(plan.startDate())
            .endDate(plan.endDate())
            .budget(plan.budget())
            .status(plan.status())
            .totalDays(plan.totalDays())
            .items(items)
            .build();
    }

    public Slice<PlanSummaryInfo> getMyPlans(long memberId, Long lastPlanId, int size) {
        long cursor = lastPlanId == null ? Long.MAX_VALUE : lastPlanId;
        return planRepositoryPort.findMyPlans(memberId, cursor, size)
            .map(this::toSummaryInfo);
    }

    private PlanItemInfo toItemInfo(PlanItem item) {
        return PlanItemInfo.builder()
            .planItemId(item.id())
            .day(item.day())
            .sequence(item.sequence())
            .itemType(item.itemType())
            .targetId(item.targetId())
            .title(item.title())
            .memo(item.memo())
            .startTime(item.startTime())
            .build();
    }

    private PlanSummaryInfo toSummaryInfo(Plan plan) {
        return PlanSummaryInfo.builder()
            .planId(plan.id())
            .petId(plan.petId())
            .areaCode(plan.areaCode())
            .title(plan.title())
            .startDate(plan.startDate())
            .endDate(plan.endDate())
            .status(plan.status())
            .build();
    }
}

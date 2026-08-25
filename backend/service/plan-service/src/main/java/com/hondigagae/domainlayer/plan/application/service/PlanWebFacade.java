package com.hondigagae.domainlayer.plan.application.service;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanSummaryItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanDetailResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.presenter.PlanPresenter;
import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanUpdateCommand;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanSummaryInfo;
import com.hondigagae.domainlayer.plan.application.port.in.PlanWebUseCase;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanCommandProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanQueryProcessor;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.persistence.dto.SliceResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlanWebFacade implements PlanWebUseCase {

    private final PlanQueryProcessor planQueryProcessor;
    private final PlanCommandProcessor planCommandProcessor;
    private final PlanPresenter planPresenter;

    @Override
    @Transactional
    public PlanDetailResponse createPlan(long memberId, PlanCreateCommand command) {
        Plan plan = planCommandProcessor.createPlan(memberId, command);
        return planPresenter.toDetailResponse(planQueryProcessor.getPlanInfo(plan));
    }

    @Override
    @Transactional(readOnly = true)
    public SliceResponse<PlanSummaryItem> getMyPlans(long memberId, Long lastPlanId, int size) {
        Slice<PlanSummaryInfo> slice = planQueryProcessor.getMyPlans(memberId, lastPlanId, size);
        return planPresenter.toSliceResponse(slice);
    }

    @Override
    @Transactional(readOnly = true)
    public PlanDetailResponse getPlan(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        PlanInfo planInfo = planQueryProcessor.getPlanInfo(plan);
        return planPresenter.toDetailResponse(planInfo);
    }

    @Override
    @Transactional
    public PlanDetailResponse updatePlan(long memberId, long planId, PlanUpdateCommand command) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        Plan updated = planCommandProcessor.updatePlan(plan, command);
        return planPresenter.toDetailResponse(planQueryProcessor.getPlanInfo(updated));
    }

    @Override
    @Transactional
    public void deletePlan(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        planCommandProcessor.softDeletePlan(plan);
    }

    @Override
    @Transactional
    public PlanDetailResponse replaceDayItems(long memberId, long planId, int day, List<PlanItemCommand> commands) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        planCommandProcessor.replaceDayItems(plan, day, commands);
        return planPresenter.toDetailResponse(planQueryProcessor.getPlanInfo(plan));
    }
}

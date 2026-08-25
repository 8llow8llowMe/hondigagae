package com.hondigagae.domainlayer.plan.application.port.in;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanSummaryItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanDetailResponse;
import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanUpdateCommand;
import com.hondigagae.persistence.dto.SliceResponse;
import java.util.List;

public interface PlanWebUseCase {

    PlanDetailResponse createPlan(long memberId, PlanCreateCommand command);

    SliceResponse<PlanSummaryItem> getMyPlans(long memberId, Long lastPlanId, int size);

    PlanDetailResponse getPlan(long memberId, long planId);

    PlanDetailResponse updatePlan(long memberId, long planId, PlanUpdateCommand command);

    void deletePlan(long memberId, long planId);

    PlanDetailResponse replaceDayItems(long memberId, long planId, int day, List<PlanItemCommand> commands);
}

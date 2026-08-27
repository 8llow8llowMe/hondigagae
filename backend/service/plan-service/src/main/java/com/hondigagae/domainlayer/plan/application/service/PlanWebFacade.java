package com.hondigagae.domainlayer.plan.application.service;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanSummaryItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanDetailResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanWeatherResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.presenter.PlanPresenter;
import com.hondigagae.domainlayer.plan.adapter.in.web.presenter.PlanWeatherPresenter;
import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanUpdateCommand;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanSummaryInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo;
import com.hondigagae.domainlayer.plan.application.port.in.PlanWebUseCase;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanCommandProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanQueryProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanWeatherProcessor;
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
    private final PlanWeatherProcessor planWeatherProcessor;
    private final PlanPresenter planPresenter;
    private final PlanWeatherPresenter planWeatherPresenter;

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

    /**
     * 일정 날씨 브리핑.
     *
     * <p><b>트랜잭션을 걸지 않는다.</b> tour-service · auth-service 원격 호출이 섞여 있어
     * DB 커넥션을 잡은 채 응답을 기다리게 되기 때문이다 (architecture-guide §3 의 문서화된 예외).
     * 소유권 확인과 항목 조회는 Processor 안의 짧은 조회로 끝난다.
     */
    @Override
    public PlanWeatherResponse getPlanWeather(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        PlanWeatherInfo info = planWeatherProcessor.brief(memberId, plan);
        return planWeatherPresenter.toResponse(info);
    }
}

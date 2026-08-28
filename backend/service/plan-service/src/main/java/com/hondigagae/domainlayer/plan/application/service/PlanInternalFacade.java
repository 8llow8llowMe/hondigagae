package com.hondigagae.domainlayer.plan.application.service;

import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanOutlineResponse;
import com.hondigagae.domainlayer.plan.adapter.in.internal.presenter.PlanInternalPresenter;
import com.hondigagae.domainlayer.plan.application.port.in.PlanInternalUseCase;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanQueryProcessor;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlanInternalFacade implements PlanInternalUseCase {

    private final PlanQueryProcessor planQueryProcessor;
    private final PlanInternalPresenter planInternalPresenter;

    /**
     * 소유권 검사를 웹 경로와 <b>같은 Processor</b>로 한다. 내부 호출이라는 이유로
     * 검사를 생략하면, 호출한 서비스의 버그 하나가 남의 일정을 새게 만든다.
     */
    @Override
    @Transactional(readOnly = true)
    public PlanOutlineResponse getPlanOutline(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        return planInternalPresenter.toOutlineResponse(planQueryProcessor.getPlanInfo(plan));
    }
}

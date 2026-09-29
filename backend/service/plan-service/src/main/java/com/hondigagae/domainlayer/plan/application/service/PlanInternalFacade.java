package com.hondigagae.domainlayer.plan.application.service;

import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanAiCommitResponse;
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

    /**
     * 담기 멱등과 <b>같은 조회</b>({@link PlanQueryProcessor#findAiCommittedPlan})를 쓴다. 소유 조건은 조회에
     * 들어 있어 남의 memberId 로는 비어 나온다 — outline 처럼 404 로 가르지 않는다. 잡 조회는 이 값이 없어도
     * 성립해야 하고, 404 로 가르면 호출한 쪽이 "없음" 과 "남의 것" 을 구분할 수 있게 된다.
     */
    @Override
    @Transactional(readOnly = true)
    public PlanAiCommitResponse getAiCommit(long memberId, String jobId) {
        Long planId = planQueryProcessor.findAiCommittedPlan(memberId, jobId).map(Plan::id).orElse(null);
        return planInternalPresenter.toAiCommitResponse(planId);
    }
}

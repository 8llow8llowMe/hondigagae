package com.hondigagae.domainlayer.plan.application.service;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanWalkSafetyResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.presenter.PlanWalkSafetyPresenter;
import com.hondigagae.domainlayer.plan.application.info.PlanWalkSafetyInfo;
import com.hondigagae.domainlayer.plan.application.port.in.PlanWalkSafetyWebUseCase;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanQueryProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanWalkSafetyProcessor;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 일정 항목 산책 위험도 유스케이스.
 *
 * <p><b>트랜잭션을 걸지 않는다.</b> 날씨 브리핑과 같은 이유다 — tour-service · auth-service
 * 원격 호출이 섞여 있어 DB 커넥션을 잡은 채 응답을 기다리게 된다 (architecture-guide §3 의
 * 문서화된 예외). 소유권 확인과 항목 조회는 Processor 안의 짧은 조회로 끝난다.
 *
 * <p>소유권은 {@link PlanQueryProcessor#getOwnedPlan} 하나로 본다. 없거나 남의 것이면 똑같이
 * 404 이고, 이 검사를 여기에 복제하지 않는다.
 */
@Service
@RequiredArgsConstructor
public class PlanWalkSafetyWebFacade implements PlanWalkSafetyWebUseCase {

    private final PlanQueryProcessor planQueryProcessor;
    private final PlanWalkSafetyProcessor planWalkSafetyProcessor;
    private final PlanWalkSafetyPresenter planWalkSafetyPresenter;

    @Override
    public PlanWalkSafetyResponse getWalkSafety(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        PlanWalkSafetyInfo info =
            planWalkSafetyProcessor.assess(memberId, plan, planQueryProcessor.getPetIds(plan));
        return planWalkSafetyPresenter.toResponse(info);
    }
}

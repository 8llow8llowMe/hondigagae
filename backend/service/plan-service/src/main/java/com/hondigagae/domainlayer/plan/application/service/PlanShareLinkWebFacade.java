package com.hondigagae.domainlayer.plan.application.service;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanShareLinkResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.SharedPlanResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.presenter.PlanShareLinkPresenter;
import com.hondigagae.domainlayer.plan.application.port.in.PlanShareLinkWebUseCase;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanQueryProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanShareLinkProcessor;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlanShareLinkWebFacade implements PlanShareLinkWebUseCase {

    private final PlanQueryProcessor planQueryProcessor;
    private final PlanShareLinkProcessor planShareLinkProcessor;
    private final PlanShareLinkPresenter planShareLinkPresenter;

    /**
     * 소유자 3종은 DB 만 만진다 — 원격 호출이 없으므로 Facade 에 트랜잭션을 그대로 건다
     * (여행 후기와 같은 판단, architecture-guide §3).
     */
    @Override
    @Transactional
    public PlanShareLinkResponse issueShareLink(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        return planShareLinkPresenter.toShareLinkResponse(planShareLinkProcessor.issue(plan));
    }

    @Override
    @Transactional(readOnly = true)
    public PlanShareLinkResponse getShareLink(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        return planShareLinkPresenter.toShareLinkResponse(planShareLinkProcessor.getActiveLink(plan));
    }

    @Override
    @Transactional
    public void revokeShareLink(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        planShareLinkProcessor.revoke(plan.id());
    }

    /**
     * 공유 링크 공개 조회.
     *
     * <p><b>트랜잭션을 걸지 않는다.</b> {@code getPlanDetailInfo} 가 장소 요약을 위해 tour-service 를
     * 부르기 때문이다 — 트랜잭션 안에서 부르면 DB 커넥션을 잡은 채 상대 응답을 기다리게 되고,
     * tour 의 지연이 plan 전체의 커넥션 풀 고갈로 번진다 (architecture-guide §3 의 문서화된 예외,
     * {@link PlanWebFacade} 의 상세·날씨·브리핑과 같은 결정). <b>공유 링크는 주소만 알면 누구나
     * 두드릴 수 있어</b> 이 경로가 커넥션을 오래 잡으면 영향이 특히 크다.
     *
     * <p>DB 구간(토큰 해석·항목 조회)은 Processor 의 메서드 단위 트랜잭션이 묶는다.
     */
    @Override
    public SharedPlanResponse getSharedPlan(String token) {
        Plan plan = planShareLinkProcessor.resolveSharedPlan(token);
        return planShareLinkPresenter.toSharedPlanResponse(planQueryProcessor.getPlanDetailInfo(plan));
    }
}

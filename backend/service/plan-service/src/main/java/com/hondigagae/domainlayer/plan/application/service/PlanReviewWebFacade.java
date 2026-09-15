package com.hondigagae.domainlayer.plan.application.service;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanReviewResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.presenter.PlanReviewPresenter;
import com.hondigagae.domainlayer.plan.application.command.PlanReviewCommand;
import com.hondigagae.domainlayer.plan.application.port.in.PlanReviewWebUseCase;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanQueryProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanReviewProcessor;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 여행 후기 유스케이스.
 *
 * <p>일정 CRUD 와 달리 <b>원격 호출이 전혀 없다</b> — 후기는 plan-service 안에서만 읽고 쓰므로
 * DB 커넥션을 잡은 채 남의 서비스를 기다리는 일이 없다. 그래서 트랜잭션을 좁히지 않고
 * 기본 규칙대로 Facade 에 건다 (architecture-guide §3).
 *
 * <p>소유권은 전부 {@link PlanQueryProcessor#getOwnedPlan} 하나로 본다. 없거나 남의 것이면
 * 똑같이 404 이고, 이 검사를 후기 쪽에 복제하지 않는다.
 */
@Service
@RequiredArgsConstructor
public class PlanReviewWebFacade implements PlanReviewWebUseCase {

    private final PlanQueryProcessor planQueryProcessor;
    private final PlanReviewProcessor planReviewProcessor;
    private final PlanReviewPresenter planReviewPresenter;

    @Override
    @Transactional(readOnly = true)
    public PlanReviewResponse getReview(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        return planReviewPresenter.toResponse(planReviewProcessor.getReview(plan));
    }

    @Override
    @Transactional
    public PlanReviewResponse createReview(long memberId, long planId, PlanReviewCommand command) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        return planReviewPresenter.toResponse(planReviewProcessor.createReview(plan, command));
    }

    @Override
    @Transactional
    public PlanReviewResponse updateReview(long memberId, long planId, PlanReviewCommand command) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        return planReviewPresenter.toResponse(planReviewProcessor.updateReview(plan, command));
    }
}

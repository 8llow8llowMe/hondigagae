package com.hondigagae.domainlayer.plan.application.service;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanPackingListResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.presenter.PlanPackingPresenter;
import com.hondigagae.domainlayer.plan.application.command.PlanPackingItemCommand;
import com.hondigagae.domainlayer.plan.application.port.in.PlanPackingWebUseCase;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanPackingProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanQueryProcessor;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 여행 준비물 유스케이스.
 *
 * <p>일정 CRUD 와 달리 <b>원격 호출이 전혀 없다</b> — 준비물은 plan-service 안에서만 읽고 쓰므로
 * DB 커넥션을 잡은 채 남의 서비스를 기다리는 일이 없다. 그래서 트랜잭션을 좁히지 않고
 * 기본 규칙대로 Facade 에 건다 (architecture-guide §3).
 *
 * <p>소유권은 전부 {@link PlanQueryProcessor#getOwnedPlan} 하나로 본다. 없거나 남의 것이면
 * 똑같이 404 이고, 이 검사를 준비물 쪽에 복제하지 않는다.
 */
@Service
@RequiredArgsConstructor
public class PlanPackingWebFacade implements PlanPackingWebUseCase {

    private final PlanQueryProcessor planQueryProcessor;
    private final PlanPackingProcessor planPackingProcessor;
    private final PlanPackingPresenter planPackingPresenter;

    @Override
    @Transactional(readOnly = true)
    public PlanPackingListResponse getPackingItems(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        return planPackingPresenter.toListResponse(planPackingProcessor.getPackingItems(plan));
    }

    @Override
    @Transactional
    public PlanPackingListResponse replacePackingItems(long memberId, long planId, List<PlanPackingItemCommand> commands) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        return planPackingPresenter.toListResponse(planPackingProcessor.replaceAiItems(plan, commands));
    }

    @Override
    @Transactional
    public PlanPackingListResponse addPackingItem(long memberId, long planId, PlanPackingItemCommand command) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        return planPackingPresenter.toListResponse(planPackingProcessor.addUserItem(plan, command));
    }

    @Override
    @Transactional
    public void markPackingItemChecked(long memberId, long planId, long packingItemId, boolean checked) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        planPackingProcessor.markChecked(plan, packingItemId, checked);
    }

    @Override
    @Transactional
    public void deletePackingItem(long memberId, long planId, long packingItemId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        planPackingProcessor.deleteItem(plan, packingItemId);
    }
}

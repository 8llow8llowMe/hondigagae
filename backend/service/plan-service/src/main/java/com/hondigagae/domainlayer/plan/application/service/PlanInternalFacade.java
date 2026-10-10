package com.hondigagae.domainlayer.plan.application.service;

import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanAiCommitResponse;
import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanCompanionReconcileResponse;
import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanOutlineResponse;
import com.hondigagae.domainlayer.plan.adapter.in.internal.presenter.PlanInternalPresenter;
import com.hondigagae.domainlayer.plan.application.model.PlanCompanionReconcileCounts;
import com.hondigagae.domainlayer.plan.application.port.in.PlanInternalUseCase;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanCompanionReconcileProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanQueryProcessor;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlanInternalFacade implements PlanInternalUseCase {

    private final PlanQueryProcessor planQueryProcessor;
    private final PlanCompanionReconcileProcessor planCompanionReconcileProcessor;
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

    /**
     * 반려견 삭제 트리거 (#972) — 새벽 배치와 <b>같은</b> {@code reconcileMember} 를 지금 돌린다.
     *
     * <p><b>{@code @Transactional} 을 걸지 않는다.</b> 대사 안에 auth-service 원격 조회("아직 살아 있는
     * 아이는 누구인가")가 있어, 여기서 트랜잭션을 열면 DB 커넥션을 잡은 채 auth 응답을 기다린다
     * (architecture-guide §3 의 문서화된 예외). 게다가 그 호출자가 바로 auth 라 중첩 대기가 된다.
     * DB 구간은 {@code PlanPetDetachProcessor} 가 <b>일정 하나</b> 단위로 트랜잭션을 연다 — 일정 하나가
     * 실패해도 이미 정리한 일정은 롤백되지 않는다.
     *
     * <p>auth 조회 실패({@code PLAN_xxx INTERNAL_SERVICE_UNAVAILABLE} 503)는 삼키지 않고 올린다. 응답을
     * 못 받은 것을 "전부 삭제됨" 으로 읽으면 멀쩡한 동행견을 떼어내므로 아무것도 하지 않는 것이 맞고,
     * 호출한 auth 는 실패를 기록한 뒤 새벽 배치에 넘긴다.
     */
    @Override
    public PlanCompanionReconcileResponse reconcileCompanions(long memberId) {
        PlanCompanionReconcileCounts counts = planCompanionReconcileProcessor.reconcileMember(memberId);
        log.info("Plan companion reconcile triggered memberId={} detached={} representativeChanged={} placeholderKept={} "
                + "legacyPlansSkipped={} remoteCalls={}", memberId, counts.detached(), counts.representativeChanged(),
            counts.placeholderKept(), counts.legacyPlansSkipped(), counts.remoteCalls());
        return planInternalPresenter.toReconcileResponse(counts);
    }
}

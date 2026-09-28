package com.hondigagae.domainlayer.plan.application.port.in;

import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanAiCommitResponse;
import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanCompanionReconcileResponse;
import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanOutlineResponse;

/**
 * 서비스 간 호출 전용 유스케이스 (coding-conventions §5).
 *
 * <p>일정의 원천은 이 서비스다. ai-service 가 하루 재생성 프롬프트에 쓸 개요를 가져간다.
 * 내부 호출이라도 memberId 로 소유권을 다시 확인한다 — 호출한 쪽을 믿지 않는다.
 */
public interface PlanInternalUseCase {

    PlanOutlineResponse getPlanOutline(long memberId, long planId);

    /**
     * 이 회원이 이 AI 일정 생성 작업을 담아 만든 일정 (#970). ai-service 의 잡 조회가 {@code committedPlanId} 로 싣는다.
     * 담은 적 없음·삭제됨·남의 것은 전부 {@code planId = null} 이고 예외가 아니다.
     */
    PlanAiCommitResponse getAiCommit(long memberId, String jobId);

    /**
     * 회원 한 명의 동행 반려견을 지금 원천(auth-service)과 대사한다 (#972).
     *
     * <p>auth-service 가 반려견 삭제를 커밋한 직후 부르는 <b>트리거</b>다. "이 petId 를 떼라" 는 사실을
     * 받지 않는다 — plan 이 auth 에 살아 있는 아이를 다시 묻고 없는 아이만 뗀다. 그래서 호출한 쪽의
     * 버그로 살아 있는 반려견이 일정에서 빠질 수 없고, 결과는 새벽 대사 배치가 같은 회원을 돌린 것과 같다.
     */
    PlanCompanionReconcileResponse reconcileCompanions(long memberId);
}

package com.hondigagae.domainlayer.plan.application.port.in;

import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanAiCommitResponse;
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
}

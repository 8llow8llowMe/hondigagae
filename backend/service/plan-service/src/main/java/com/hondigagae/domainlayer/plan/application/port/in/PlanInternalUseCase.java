package com.hondigagae.domainlayer.plan.application.port.in;

import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanOutlineResponse;

/**
 * 서비스 간 호출 전용 유스케이스 (coding-conventions §5).
 *
 * <p>일정의 원천은 이 서비스다. ai-service 가 하루 재생성 프롬프트에 쓸 개요를 가져간다.
 * 내부 호출이라도 memberId 로 소유권을 다시 확인한다 — 호출한 쪽을 믿지 않는다.
 */
public interface PlanInternalUseCase {

    PlanOutlineResponse getPlanOutline(long memberId, long planId);
}

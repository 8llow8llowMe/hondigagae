package com.hondigagae.domainlayer.plan.adapter.in.internal.dto;

import lombok.Builder;

/**
 * AI 일정 생성 작업을 담아 만든 일정 (#970). ai-service 가 잡 조회에 {@code committedPlanId} 를 실을 때 쓴다.
 *
 * <p>담긴 사실의 정본은 이 서비스다 — 잡(Redis)에 적어 두면 잡 TTL 과 함께 사라지고, 일정을 지워도
 * 잡은 모른다. 그래서 잡 조회가 매번 여기에 묻는다.
 *
 * @param planId 담은 일정 아이디. 담은 적이 없거나, 담은 일정을 삭제했거나, 남의 작업이면 {@code null} 이다 —
 *               세 경우를 가르지 않는다. 소비 측이 할 일은 모두 "담기 전 화면" 으로 같고, 가르면 남의
 *               jobId 가 담겼는지를 알려 주는 셈이 된다
 */
@Builder
public record PlanAiCommitResponse(
    Long planId
) {
}

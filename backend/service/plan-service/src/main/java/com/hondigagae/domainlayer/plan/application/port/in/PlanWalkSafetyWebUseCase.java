package com.hondigagae.domainlayer.plan.application.port.in;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanWalkSafetyResponse;

/**
 * 일정 항목 산책 위험도 유스케이스.
 *
 * <p>일정 CRUD·날씨 브리핑과 유스케이스를 나눈 이유는 <b>묻는 질문이 다르기 때문</b>이다.
 * 날씨 브리핑은 일자에, 이것은 항목의 시각에 답한다. 소유권 규칙은 같으므로
 * {@code PlanQueryProcessor.getOwnedPlan} 하나를 그대로 쓴다 — 후기와 같은 판단이다.
 */
public interface PlanWalkSafetyWebUseCase {

    PlanWalkSafetyResponse getWalkSafety(long memberId, long planId);
}

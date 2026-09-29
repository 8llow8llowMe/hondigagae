package com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * plan-service AI 담기 조회 응답의 Feign 전용 표현 (coding-conventions §12-1, #970).
 *
 * @param planId 담은 일정 아이디. 담은 적 없음·삭제됨·남의 작업이면 null 이다 (plan 쪽이 셋을 가르지 않는다)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanAiCommitClientResponse(
    Long planId
) {
}

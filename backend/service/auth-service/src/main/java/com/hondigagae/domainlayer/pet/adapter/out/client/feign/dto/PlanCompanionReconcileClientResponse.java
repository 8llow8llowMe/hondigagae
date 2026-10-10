package com.hondigagae.domainlayer.pet.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * plan-service {@code POST /internal/v1/plans/companions/reconcile} 응답 (#972).
 *
 * <p>로그에 남길 건수만 받는다. 모르는 필드는 무시한다 — plan 이 집계 값을 늘려도 auth 가 역직렬화에서
 * 깨지면 안 된다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanCompanionReconcileClientResponse(
    int detached,
    int representativeChanged,
    int placeholderKept
) {
}

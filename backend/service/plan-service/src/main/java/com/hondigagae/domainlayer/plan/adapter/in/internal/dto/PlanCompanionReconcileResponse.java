package com.hondigagae.domainlayer.plan.adapter.in.internal.dto;

import lombok.Builder;

/**
 * 반려견 삭제 직후 auth-service 가 요청한 동행 목록 대사의 결과 (#972).
 *
 * <p>호출한 쪽은 이 값으로 아무것도 결정하지 않는다 — 로그에 남겨 "삭제 트리거가 실제로 무엇을
 * 떼어냈는가" 를 새벽 배치 로그와 같은 눈금으로 읽기 위한 것이다. 그래서 내부 집계
 * ({@code PlanCompanionReconcileCounts}) 중 결과를 설명하는 세 값만 내보낸다.
 *
 * @param detached              실제로 지운 {@code plan_pet} 행 수
 * @param representativeChanged 대표 반려견({@code plan.pet_id})을 승계한 일정 수
 * @param placeholderKept       마지막 한 마리라 떼지 않고 자리 표시자로 남긴 일정 수 (R3)
 */
@Builder
public record PlanCompanionReconcileResponse(
    int detached,
    int representativeChanged,
    int placeholderKept
) {
}

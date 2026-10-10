package com.hondigagae.domainlayer.plan.domain.model;

import lombok.Builder;

/**
 * 일정에 동행하는 반려견 한 마리 (plan ↔ pet 다대다의 한 행).
 *
 * <p>{@link Plan#petId()} 는 이 목록의 첫 번째(대표) 반려견과 같다. 목록 전체가 필요한
 * 곳(조회 응답·날씨 판정)은 이 모델을, 한 마리만 있으면 되는 곳은 {@code Plan.petId} 를 본다.
 */
@Builder
public record PlanPet(
    long id,
    long planId,
    long petId
) {
}

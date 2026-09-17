package com.hondigagae.domainlayer.plan.domain.model;

import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import lombok.Builder;

/**
 * 일정을 완료한 <b>그 시점</b>의 동행 반려견 특성 (#629).
 *
 * <p>진행 중(초안·확정)인 일정은 auth-service 를 매번 다시 읽는다 — 아이의 체중이나 민감도를
 * 고치면 다음 판정에 곧바로 반영되어야 하기 때문이다. 완료된 여행은 반대다. 다녀온 뒤에
 * 프로필을 고쳤다고 "그때 몽실이 기준" 이 뒤늦게 달라지면 그 기록은 거짓이 된다.
 *
 * <p><b>보관 범위는 {@link PetConditionQueryResult} 와 같다</b> — 이 서비스가 실제로 판정에
 * 넘기는 축뿐이다. 이름·생년월 원문은 애초에 내부 계약이 내보내지 않는다
 * ({@code PetConditionResponse}). 읽지도 않는 값을 기록이라는 이유로 더 쌓지 않는다.
 */
@Builder
public record PlanPetCondition(
    long id,
    long planId,
    long petId,
    String breed,
    String sizeType,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    String activityLevel
) {

    public static PlanPetCondition of(long id, long planId, long petId, PetConditionQueryResult condition) {
        return PlanPetCondition.builder()
            .id(id)
            .planId(planId)
            .petId(petId)
            .breed(condition.breed())
            .sizeType(condition.sizeType())
            .heatSensitive(condition.heatSensitive())
            .coldSensitive(condition.coldSensitive())
            .noiseSensitive(condition.noiseSensitive())
            .activityLevel(condition.activityLevel())
            .build();
    }

    public PetConditionQueryResult toQueryResult() {
        return PetConditionQueryResult.builder()
            .breed(breed)
            .sizeType(sizeType)
            .heatSensitive(heatSensitive)
            .coldSensitive(coldSensitive)
            .noiseSensitive(noiseSensitive)
            .activityLevel(activityLevel)
            .build();
    }
}

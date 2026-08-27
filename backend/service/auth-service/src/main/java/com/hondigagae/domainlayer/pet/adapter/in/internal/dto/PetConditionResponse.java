package com.hondigagae.domainlayer.pet.adapter.in.internal.dto;

import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import lombok.Builder;

/**
 * 다른 서비스가 판정에 쓰는 반려견 특성.
 *
 * <p>웹 응답({@code PetResponse})과 다른 DTO 를 쓰는 이유는 내보내는 범위가 다르기 때문이다.
 * 여기에는 <b>이름과 생년월을 넣지 않는다</b> - 날씨 적합도와 산책 위험도를 판정하는 데는
 * 필요 없고, 서비스 경계를 넘는 개인정보는 최소로 유지한다 (services/ai-service.md 의
 * 프롬프트 개인정보 최소화 방침과 같은 이유).
 *
 * <p>견종은 예외로 넘긴다. 단두종 판정에 실제로 쓰이고, 그 자체로는 개인을 식별하지 않는다.
 */
@Builder
public record PetConditionResponse(
    String petId,
    String breed,
    PetSizeType sizeType,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    ActivityLevel activityLevel,
    boolean walkPreferred
) {
}

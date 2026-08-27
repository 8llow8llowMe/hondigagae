package com.hondigagae.domainlayer.pet.domain.model;

import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.pet.SocialityLevel;
import lombok.Builder;

/**
 * 반려견 프로필. AI 여행 설계의 핵심 입력이며 이 서비스가 단일 원천이다.
 *
 * <p>{@code birthYm}은 생년월(yyyy-MM) 문자열로 다룬다. 일 단위 정보는 필요 없고,
 * 사용자가 정확한 생일을 모르는 경우가 많아 월 단위까지만 받는다.
 */
@Builder
public record Pet(
    long id,
    long memberId,
    String name,
    String breed,
    String birthYm,
    PetSizeType sizeType,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    ActivityLevel activityLevel,
    boolean walkPreferred,
    SocialityLevel sociality,
    boolean deleted
) {

    public Pet update(
        String name, String breed, String birthYm, PetSizeType sizeType,
        boolean heatSensitive, boolean coldSensitive, boolean noiseSensitive,
        ActivityLevel activityLevel, boolean walkPreferred, SocialityLevel sociality
    ) {
        return Pet.builder()
            .id(id).memberId(memberId)
            .name(name).breed(breed).birthYm(birthYm).sizeType(sizeType)
            .heatSensitive(heatSensitive).coldSensitive(coldSensitive).noiseSensitive(noiseSensitive)
            .activityLevel(activityLevel).walkPreferred(walkPreferred).sociality(sociality)
            .deleted(deleted)
            .build();
    }

    /**
     * 소프트 삭제. 이미 생성된 여행 일정이 petId를 참조하므로 물리 삭제하지 않는다.
     */
    public Pet delete() {
        return Pet.builder()
            .id(id).memberId(memberId)
            .name(name).breed(breed).birthYm(birthYm).sizeType(sizeType)
            .heatSensitive(heatSensitive).coldSensitive(coldSensitive).noiseSensitive(noiseSensitive)
            .activityLevel(activityLevel).walkPreferred(walkPreferred).sociality(sociality)
            .deleted(true)
            .build();
    }

    public boolean isOwnedBy(long memberId) {
        return this.memberId == memberId;
    }
}

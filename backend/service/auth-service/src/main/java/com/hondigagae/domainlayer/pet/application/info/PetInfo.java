package com.hondigagae.domainlayer.pet.application.info;

import com.hondigagae.domainlayer.pet.domain.enums.ActivityLevel;
import com.hondigagae.domainlayer.pet.domain.enums.PetSizeType;
import com.hondigagae.domainlayer.pet.domain.enums.SocialityLevel;
import com.hondigagae.domainlayer.pet.domain.model.Pet;
import lombok.Builder;

@Builder
public record PetInfo(
    long petId,
    String name,
    String breed,
    String birthYm,
    PetSizeType sizeType,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    ActivityLevel activityLevel,
    boolean walkPreferred,
    SocialityLevel sociality
) {

    public static PetInfo from(Pet pet) {
        return PetInfo.builder()
            .petId(pet.id())
            .name(pet.name())
            .breed(pet.breed())
            .birthYm(pet.birthYm())
            .sizeType(pet.sizeType())
            .heatSensitive(pet.heatSensitive())
            .coldSensitive(pet.coldSensitive())
            .noiseSensitive(pet.noiseSensitive())
            .activityLevel(pet.activityLevel())
            .walkPreferred(pet.walkPreferred())
            .sociality(pet.sociality())
            .build();
    }
}

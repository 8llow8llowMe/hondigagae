package com.hondigagae.domainlayer.pet.application.info;

import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.pet.SocialityLevel;
import com.hondigagae.domainlayer.pet.domain.model.Pet;
import java.math.BigDecimal;
import lombok.Builder;

@Builder
public record PetInfo(
    long petId,
    String name,
    String breed,
    String birthYm,
    PetSizeType sizeType,
    BigDecimal weightKg,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    ActivityLevel activityLevel,
    boolean walkPreferred,
    SocialityLevel sociality,
    String profileImageKey,
    boolean representative
) {

    public static PetInfo from(Pet pet) {
        return PetInfo.builder()
            .petId(pet.id())
            .name(pet.name())
            .breed(pet.breed())
            .birthYm(pet.birthYm())
            .sizeType(pet.sizeType())
            .weightKg(pet.weightKg())
            .heatSensitive(pet.heatSensitive())
            .coldSensitive(pet.coldSensitive())
            .noiseSensitive(pet.noiseSensitive())
            .activityLevel(pet.activityLevel())
            .walkPreferred(pet.walkPreferred())
            .sociality(pet.sociality())
            .profileImageKey(pet.profileImageKey())
            .representative(pet.representative())
            .build();
    }
}

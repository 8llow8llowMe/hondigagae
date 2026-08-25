package com.hondigagae.domainlayer.pet.application.command;

import com.hondigagae.domainlayer.pet.domain.enums.ActivityLevel;
import com.hondigagae.domainlayer.pet.domain.enums.PetSizeType;
import com.hondigagae.domainlayer.pet.domain.enums.SocialityLevel;
import lombok.Builder;

/**
 * 반려견 등록/수정 공통 커맨드. 두 요청의 입력 항목이 동일해 하나로 둔다.
 */
@Builder
public record PetSaveCommand(
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
}

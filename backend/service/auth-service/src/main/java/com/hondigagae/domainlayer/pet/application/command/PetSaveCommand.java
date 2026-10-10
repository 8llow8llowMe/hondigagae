package com.hondigagae.domainlayer.pet.application.command;

import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.pet.SocialityLevel;
import java.math.BigDecimal;
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
    BigDecimal weightKg,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    ActivityLevel activityLevel,
    boolean walkPreferred,
    SocialityLevel sociality
) {
}

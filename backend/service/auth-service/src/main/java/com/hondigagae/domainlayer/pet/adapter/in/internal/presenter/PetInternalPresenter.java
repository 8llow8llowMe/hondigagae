package com.hondigagae.domainlayer.pet.adapter.in.internal.presenter;

import com.hondigagae.domainlayer.pet.adapter.in.internal.dto.PetConditionResponse;
import com.hondigagae.domainlayer.pet.application.info.PetInfo;
import com.hondigagae.domainlayer.pet.domain.model.Pet;
import java.time.YearMonth;
import org.springframework.stereotype.Component;

@Component
public class PetInternalPresenter {

    /**
     * 판정에 필요한 특성만 옮긴다. 이름과 생년월 원문은 의도적으로 제외한다 -
     * 서비스 경계를 넘는 개인정보는 최소로 유지한다. 나이는 판정에 필요해 파생값(개월 수)만 넘긴다.
     */
    public PetConditionResponse toConditionResponse(PetInfo petInfo) {
        return PetConditionResponse.builder()
            .petId(String.valueOf(petInfo.petId()))
            .breed(petInfo.breed())
            .sizeType(petInfo.sizeType())
            .ageMonths(Pet.ageMonths(petInfo.birthYm(), YearMonth.now()))
            .weightKg(petInfo.weightKg())
            .heatSensitive(petInfo.heatSensitive())
            .coldSensitive(petInfo.coldSensitive())
            .noiseSensitive(petInfo.noiseSensitive())
            .activityLevel(petInfo.activityLevel())
            .walkPreferred(petInfo.walkPreferred())
            .build();
    }
}

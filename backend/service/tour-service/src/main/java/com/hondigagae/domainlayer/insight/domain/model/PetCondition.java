package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.pet.SocialityLevel;
import lombok.Builder;

/**
 * 판정에 쓰는 반려견 조건.
 *
 * <p><b>반려견 프로필의 원천은 auth-service 다.</b> tour-service 는 그 사본을 갖지 않고 요청
 * 파라미터로 받는다. 공개 조회 서비스에 회원 인증을 끌어들이지 않기 위해서이기도 하고,
 * 같은 장소를 다른 아이 기준으로 비교해 보는 것이 이 기능의 자연스러운 쓰임이기 때문이다.
 *
 * <p>전부 선택값이다. 아무것도 주지 않으면 반려견 특성을 뺀 일반 조건으로 판정한다 -
 * 비회원도 장소를 볼 수 있어야 한다.
 */
@Builder
public record PetCondition(
    PetSizeType sizeType,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    ActivityLevel activityLevel,
    String breed,
    // 사회성. 낮음만 판정에 쓴다 - 보통/높음은 제약이 아니다 (#425)
    SocialityLevel sociality
) {

    public static PetCondition unspecified() {
        return PetCondition.builder().build();
    }

    /** 반려견 조건이 하나라도 주어졌는지. 응답에 "이 아이 기준" 인지 표시할 때 쓴다. */
    public boolean isSpecified() {
        return sizeType != null || heatSensitive || coldSensitive || noiseSensitive
            || activityLevel != null || (breed != null && !breed.isBlank()) || sociality != null;
    }

    /** 붐비는 환경을 피해야 하는 사회성인지. 다른 개·낯선 사람과의 대면이 부담이라 소음 민감과 이유가 다르다. */
    public boolean hasLowSociality() {
        return sociality == SocialityLevel.LOW;
    }

    /** 이름을 부를 수 없으므로 문장에서 주어로 쓸 표현. */
    public String subject() {
        return breed != null && !breed.isBlank() ? breed : "반려견";
    }
}

package com.hondigagae.shared.travel.pet;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 다른 개·사람에 대한 사회성. 붐비는 장소나 애견 동반 시설 추천 여부를 가른다.
 */
@Getter
@RequiredArgsConstructor
public enum SocialityLevel implements CodeNameDescribable {

    LOW("낮음", "다른 개나 낯선 사람을 불편해합니다."),
    MEDIUM("보통", "상황에 따라 적응합니다."),
    HIGH("높음", "다른 개나 사람과 잘 어울립니다.");

    private final String displayName;
    private final String description;
}

package com.hondigagae.domainlayer.pet.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 반려견 활동량. AI 여행 플래너가 하루 이동량과 산책 코스 난이도를 정하는 입력이다.
 */
@Getter
@RequiredArgsConstructor
public enum ActivityLevel {

    LOW("낮음", "짧은 산책을 선호하며 장시간 활동을 힘들어합니다."),
    MEDIUM("보통", "일반적인 산책과 관광 일정을 소화합니다."),
    HIGH("높음", "긴 산책과 활동적인 일정을 선호합니다.");

    private final String displayName;
    private final String description;
}

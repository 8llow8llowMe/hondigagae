package com.hondigagae.domainlayer.plan.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum PackingItemSource {

    AI("AI 추천", "AI 가 이 여행의 일정·날씨·반려견 특성을 근거로 제안한 항목입니다."),
    USER("직접 추가", "사용자가 직접 적어 둔 항목입니다. AI 재생성에도 지워지지 않습니다.");

    private final String displayName;
    private final String description;
}

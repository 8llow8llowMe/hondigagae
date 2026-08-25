package com.hondigagae.domainlayer.plan.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum PlanStatus {

    DRAFT("초안", "AI 또는 사용자가 작성 중인 일정입니다."),
    CONFIRMED("확정", "여행이 확정된 일정입니다."),
    COMPLETED("완료", "여행을 마친 일정입니다.");

    private final String displayName;
    private final String description;
}

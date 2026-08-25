package com.hondigagae.domainlayer.plan.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum PlanItemType {

    PLACE("장소", "관광지·카페 등 방문 장소 항목입니다."),
    MEAL("식사", "식당 방문 항목입니다."),
    LODGING("숙박", "숙소 체크인/숙박 항목입니다."),
    WALK("산책", "산책 코스 항목입니다."),
    MOVE("이동", "이동 구간 항목입니다.");

    private final String displayName;
    private final String description;
}

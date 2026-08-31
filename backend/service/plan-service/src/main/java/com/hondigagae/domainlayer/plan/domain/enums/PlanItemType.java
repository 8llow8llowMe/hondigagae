package com.hondigagae.domainlayer.plan.domain.enums;

import java.util.Set;
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

    /**
     * {@code targetId} 가 {@code place.id} 를 가리키는 유형.
     *
     * <p><b>{@code WALK} 는 들어가지 않는다.</b> 그 {@code targetId} 는 {@code walk_course.id} 라
     * 장소로 조회하면 남의 아이디로 없는 장소를 찾게 된다. {@code MOVE} 는 대상이 없다.
     *
     * <p>이 집합을 쓰는 곳이 둘이다 — 저장 시 존재 검증(PlanCommandProcessor)과 상세 응답의
     * 장소 요약 조회(PlanQueryProcessor). 각자 들고 있으면 한쪽만 고쳐질 자리라 도메인으로 올렸다.
     */
    private static final Set<PlanItemType> PLACE_TARGETS = Set.of(PLACE, MEAL, LODGING);

    private final String displayName;
    private final String description;

    public boolean isPlaceTarget() {
        return PLACE_TARGETS.contains(this);
    }
}

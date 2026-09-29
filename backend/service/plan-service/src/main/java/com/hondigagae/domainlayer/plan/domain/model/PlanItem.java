package com.hondigagae.domainlayer.plan.domain.model;

import com.hondigagae.shared.travel.plan.PlanItemType;
import java.time.LocalTime;
import lombok.Builder;

@Builder(toBuilder = true)
public record PlanItem(
    long id,
    long planId,
    int day,
    int sequence,
    PlanItemType itemType,
    Long targetId,
    String title,
    String memo,
    LocalTime startTime,
    boolean visited
) {

    public PlanItem withVisited(boolean visited) {
        return toBuilder().visited(visited).build();
    }

    /** 시작 시각만 바꾼다. null 이면 비운다. 아이디 · 방문 체크 · 순서는 그대로다 (#1030). */
    public PlanItem withStartTime(LocalTime startTime) {
        return toBuilder().startTime(startTime).build();
    }
}

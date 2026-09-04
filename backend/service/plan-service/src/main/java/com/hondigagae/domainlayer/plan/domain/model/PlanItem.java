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
}

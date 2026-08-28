package com.hondigagae.domainlayer.plan.application.info;

import com.hondigagae.domainlayer.plan.domain.enums.PlanItemType;
import java.time.LocalTime;
import lombok.Builder;

@Builder
public record PlanItemInfo(
    long planItemId,
    int day,
    int sequence,
    PlanItemType itemType,
    Long targetId,
    String title,
    String memo,
    LocalTime startTime,
    boolean visited
) {

}

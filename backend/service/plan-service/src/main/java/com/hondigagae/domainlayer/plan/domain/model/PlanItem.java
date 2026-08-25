package com.hondigagae.domainlayer.plan.domain.model;

import com.hondigagae.domainlayer.plan.domain.enums.PlanItemType;
import java.time.LocalTime;
import lombok.Builder;

@Builder
public record PlanItem(
    long id,
    long planId,
    int day,
    int sequence,
    PlanItemType itemType,
    Long targetId,
    String title,
    String memo,
    LocalTime startTime
) {

}

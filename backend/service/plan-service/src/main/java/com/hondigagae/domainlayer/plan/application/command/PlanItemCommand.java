package com.hondigagae.domainlayer.plan.application.command;

import com.hondigagae.domainlayer.plan.domain.enums.PlanItemType;
import java.time.LocalTime;
import lombok.Builder;

@Builder
public record PlanItemCommand(
    int day,
    int sequence,
    PlanItemType itemType,
    Long targetId,
    String title,
    String memo,
    LocalTime startTime
) {

}

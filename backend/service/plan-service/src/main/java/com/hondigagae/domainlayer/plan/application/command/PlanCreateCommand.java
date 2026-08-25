package com.hondigagae.domainlayer.plan.application.command;

import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

@Builder
public record PlanCreateCommand(
    long petId,
    String areaCode,
    String sigunguCode,
    String title,
    LocalDate startDate,
    LocalDate endDate,
    Integer budget,
    List<PlanItemCommand> items
) {

}

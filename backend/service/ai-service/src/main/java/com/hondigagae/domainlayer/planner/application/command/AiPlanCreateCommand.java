package com.hondigagae.domainlayer.planner.application.command;

import java.time.LocalDate;
import lombok.Builder;

@Builder
public record AiPlanCreateCommand(
    String areaCode,
    LocalDate startDate,
    LocalDate endDate,
    Long budget,
    long petId,
    String requestNote
) {

}

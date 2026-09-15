package com.hondigagae.domainlayer.plan.application.command;

import java.time.LocalDate;
import lombok.Builder;

@Builder
public record PlanCopyCommand(
    String title,
    LocalDate startDate,
    LocalDate endDate
) {

}

package com.hondigagae.domainlayer.plan.application.command;

import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import java.time.LocalDate;
import lombok.Builder;

@Builder
public record PlanUpdateCommand(
    String title,
    LocalDate startDate,
    LocalDate endDate,
    Integer budget,
    PlanStatus status
) {

}

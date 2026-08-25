package com.hondigagae.domainlayer.plan.application.info;

import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import java.time.LocalDate;
import lombok.Builder;

@Builder
public record PlanSummaryInfo(
    long planId,
    long petId,
    String areaCode,
    String title,
    LocalDate startDate,
    LocalDate endDate,
    PlanStatus status
) {

}

package com.hondigagae.domainlayer.plan.application.info;

import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

@Builder
public record PlanInfo(
    long planId,
    long petId,
    String areaCode,
    String sigunguCode,
    String title,
    LocalDate startDate,
    LocalDate endDate,
    Integer budget,
    PlanStatus status,
    int totalDays,
    List<PlanItemInfo> items
) {

}

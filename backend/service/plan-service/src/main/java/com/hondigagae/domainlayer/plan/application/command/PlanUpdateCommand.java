package com.hondigagae.domainlayer.plan.application.command;

import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

@Builder
public record PlanUpdateCommand(
    String title,
    LocalDate startDate,
    LocalDate endDate,
    Integer budget,
    PlanStatus status,

    /** null 은 "동행견을 건드리지 않는다". 목록이 오면 그것으로 <b>전량 교체</b>한다. */
    List<Long> petIds
) {

}

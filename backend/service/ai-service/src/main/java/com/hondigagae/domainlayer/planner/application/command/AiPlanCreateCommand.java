package com.hondigagae.domainlayer.planner.application.command;

import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

@Builder
public record AiPlanCreateCommand(
    String areaCode,
    LocalDate startDate,
    LocalDate endDate,
    Long budget,
    // 동반 반려견. 비어 있으면 워커가 대표 반려견으로 대신한다.
    List<Long> petIds,
    String requestNote
) {

}

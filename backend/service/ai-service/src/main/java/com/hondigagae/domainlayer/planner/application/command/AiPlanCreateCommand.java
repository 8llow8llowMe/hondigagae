package com.hondigagae.domainlayer.planner.application.command;

import com.hondigagae.domainlayer.planner.adapter.in.web.dto.request.AiPlanCreateRequest;
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

    public static AiPlanCreateCommand from(AiPlanCreateRequest request) {
        return AiPlanCreateCommand.builder()
            .areaCode(request.areaCode())
            .startDate(request.startDate())
            .endDate(request.endDate())
            .budget(request.budget())
            .petId(request.petId())
            .requestNote(request.requestNote())
            .build();
    }
}

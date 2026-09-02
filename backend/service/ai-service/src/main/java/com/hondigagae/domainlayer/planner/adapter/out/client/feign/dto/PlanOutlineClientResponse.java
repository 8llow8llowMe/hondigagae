package com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * plan-service 일정 개요 응답의 Feign 전용 표현 (coding-conventions §12-1).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanOutlineClientResponse(
    Long planId,
    Long petId,
    String startDate,
    String endDate,
    String areaCode,
    List<DayClientResponse> days
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DayClientResponse(
        Integer day,
        List<ItemClientResponse> items
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ItemClientResponse(
        String title,
        String itemType,
        Long placeId
    ) {
    }
}

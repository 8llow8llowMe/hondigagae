package com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * plan-service 일정 개요 응답의 Feign 전용 표현 (coding-conventions §12-1).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanOutlineClientResponse(
    Long planId,
    // 대표 반려견 (petIds 의 첫 번째). 옛 응답 호환으로 남긴다.
    Long petId,
    // 동행 반려견 전체. 준비물 생성이 아이별 특성을 모두 근거로 삼는 데 쓴다.
    List<Long> petIds,
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

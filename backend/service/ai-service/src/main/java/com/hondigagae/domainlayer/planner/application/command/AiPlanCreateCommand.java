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
    // 반드시 일정에 배치할 장소. 후보 목록에 강제로 합쳐진다.
    List<Long> pinnedPlaceIds,
    String requestNote,
    // 즐겨찾기 우선 반영. 찜한 장소를 후보에 합치고 프롬프트에 선호 표시를 한다.
    boolean preferFavorites,
    // 하루 재생성. 둘 다 있어야 하며, 지정한 일차만 새로 짜고 나머지는 기존 일정을 유지한다.
    Long planId,
    Integer regenerateDay
) {

}

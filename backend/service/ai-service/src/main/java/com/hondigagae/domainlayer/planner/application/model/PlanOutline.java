package com.hondigagae.domainlayer.planner.application.model;

import java.util.List;
import lombok.Builder;

/**
 * 하루 재생성의 맥락으로 쓰는 기존 일정 개요. 프롬프트에 "다른 날은 이대로 유지"의
 * 근거로 실린다 — 이 값이 없으면 재생성이 아니라 전체 새 일정이 된다.
 */
@Builder
public record PlanOutline(
    long planId,
    // 일정에 연결된 반려견. 준비물 생성의 특성 조회 키다. 옛 응답에는 없을 수 있어 nullable.
    Long petId,
    String areaCode,
    String startDate,
    String endDate,
    List<PlanOutlineDay> days
) {

    public List<PlanOutlineDay> safeDays() {
        return days == null ? List.of() : days;
    }

    @Builder
    public record PlanOutlineDay(
        int day,
        List<PlanOutlineItem> items
    ) {

        public List<PlanOutlineItem> safeItems() {
            return items == null ? List.of() : items;
        }
    }

    @Builder
    public record PlanOutlineItem(
        String title,
        String itemType,
        Long placeId
    ) {
    }
}

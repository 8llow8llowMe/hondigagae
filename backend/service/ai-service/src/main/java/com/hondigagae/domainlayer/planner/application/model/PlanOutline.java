package com.hondigagae.domainlayer.planner.application.model;

import java.util.List;
import java.util.Objects;
import lombok.Builder;

/**
 * 하루 재생성의 맥락으로 쓰는 기존 일정 개요. 프롬프트에 "다른 날은 이대로 유지"의
 * 근거로 실린다 — 이 값이 없으면 재생성이 아니라 전체 새 일정이 된다.
 */
@Builder
public record PlanOutline(
    long planId,
    // 대표 반려견 (petIds 의 첫 번째). 옛 응답에는 없을 수 있어 nullable.
    Long petId,
    // 동행 반려견 전체. 옛 응답에는 없을 수 있어 비어 있을 수 있다.
    List<Long> petIds,
    String areaCode,
    String startDate,
    String endDate,
    List<PlanOutlineDay> days
) {

    public List<PlanOutlineDay> safeDays() {
        return days == null ? List.of() : days;
    }

    /**
     * 특성을 조회할 반려견 전체.
     *
     * <p>{@code petIds} 가 비어 있으면 대표 한 마리로 접는다 - <b>옛 응답 호환</b>이다.
     * plan-service 가 {@code petIds} 를 내리기 전에 만들어진 일정이 아직 있을 수 있고,
     * 그때 준비물이 아예 특성 없이 만들어지는 것보다 대표 한 마리라도 보는 편이 낫다.
     */
    public List<Long> conditionPetIds() {
        if (petIds != null && !petIds.isEmpty()) {
            return petIds.stream().filter(Objects::nonNull).distinct().toList();
        }
        return petId == null ? List.of() : List.of(petId);
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

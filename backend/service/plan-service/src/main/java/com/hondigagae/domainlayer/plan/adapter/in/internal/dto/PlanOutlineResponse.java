package com.hondigagae.domainlayer.plan.adapter.in.internal.dto;

import java.util.List;
import lombok.Builder;

/**
 * 다른 서비스(ai-service)가 하루 재생성의 맥락으로 쓰는 일정 개요.
 *
 * <p>웹 상세 응답({@code PlanDetailResponse})과 다른 DTO 를 쓰는 이유는 내보내는 범위가
 * 다르기 때문이다. 재생성 프롬프트에는 "어느 날 어디를 가는가"만 필요하다 — 메모나
 * 시간대 같은 개인 기록은 서비스 경계를 넘기지 않는다.
 */
@Builder
public record PlanOutlineResponse(
    long planId,
    String startDate,
    String endDate,
    String areaCode,
    List<DayOutline> days
) {

    @Builder
    public record DayOutline(
        int day,
        List<ItemOutline> items
    ) {
    }

    @Builder
    public record ItemOutline(
        String title,
        String itemType,
        Long placeId
    ) {
    }
}

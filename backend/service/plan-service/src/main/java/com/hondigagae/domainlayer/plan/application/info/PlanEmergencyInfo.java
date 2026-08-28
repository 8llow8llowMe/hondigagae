package com.hondigagae.domainlayer.plan.application.info;

import java.util.List;
import lombok.Builder;

/**
 * 일정 응급 브리핑 — 일자별 방문 장소마다 가까운 동물병원·동물약국을 미리 묶어 둔 것.
 * 급할 때 찾기 시작하면 늦다. 출발 전에 "어디서 문제가 생기면 어디로 가는가"를 한 번에 준다.
 */
@Builder
public record PlanEmergencyInfo(
    long planId,
    int radiusMeters,
    List<DayEmergencyInfo> days
) {

    @Builder
    public record DayEmergencyInfo(
        int day,
        List<SpotEmergencyInfo> spots
    ) {
    }

    /** 일정 항목(방문 장소) 하나 기준의 주변 시설 묶음. */
    @Builder
    public record SpotEmergencyInfo(
        long planItemId,
        long placeId,
        String title,
        List<FacilityInfo> facilities
    ) {
    }

    @Builder
    public record FacilityInfo(
        String name,
        String typeName,
        String addr,
        String tel,
        int distanceMeters,
        boolean open24,
        boolean operatingHoursKnown
    ) {
    }
}

package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.info.PlanEmergencyInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanEmergencyInfo.DayEmergencyInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanEmergencyInfo.FacilityInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanEmergencyInfo.SpotEmergencyInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemInfo;
import com.hondigagae.domainlayer.plan.application.port.out.EmergencyFacilityQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPlaceLookupPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.EmergencyFacilityQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlanPlacePointQueryResult;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 일정 응급 브리핑 — 일자별 방문 장소마다 가까운 동물병원·동물약국을 미리 묶는다.
 *
 * <p>급할 때 검색을 시작하면 늦다. 출발 전에 "어디서 문제가 생기면 어디로 가는가"를
 * 한 번에 보여 주는 것이 목적이다. 같은 장소가 여러 날 나와도 시설 검색은 장소당
 * 한 번만 한다(placeId 기준 캐시).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlanEmergencyProcessor {

    /** 검색 반경. 제주 도로 사정 기준으로 차로 15분 안팎이다. */
    private static final int SEARCH_RADIUS_METERS = 10_000;
    /** 장소당 시설 수. 브리핑은 목록이 아니라 "가장 가까운 몇 곳"이면 충분하다. */
    private static final int FACILITIES_PER_SPOT = 3;

    private final PlanQueryProcessor planQueryProcessor;
    private final PlanPlaceLookupPort planPlaceLookupPort;
    private final EmergencyFacilityQueryPort emergencyFacilityQueryPort;

    public PlanEmergencyInfo getEmergencyBriefing(long memberId, long planId) {
        Plan plan = planQueryProcessor.getOwnedPlan(memberId, planId);
        PlanInfo planInfo = planQueryProcessor.getPlanInfo(plan);

        // 장소를 참조하는 항목만 브리핑 대상이다. 이동·좌표 없는 항목은 검색 중심점이 없다.
        List<PlanItemInfo> placeItems = planInfo.items().stream()
            .filter(item -> item.targetId() != null)
            .toList();

        List<Long> placeIds = placeItems.stream().map(PlanItemInfo::targetId).distinct().toList();
        Map<Long, PlanPlacePointQueryResult> points = planPlaceLookupPort.findPoints(placeIds).stream()
            .collect(Collectors.toMap(PlanPlacePointQueryResult::placeId, Function.identity()));

        // 같은 장소는 한 번만 검색한다 — 며칠 연속 같은 숙소여도 시설은 같다.
        Map<Long, List<EmergencyFacilityQueryResult>> facilitiesByPlace = new HashMap<>();

        Map<Integer, List<SpotEmergencyInfo>> spotsByDay = new TreeMap<>();
        for (PlanItemInfo item : placeItems) {
            PlanPlacePointQueryResult point = points.get(item.targetId());
            if (point == null) {
                // 원천에서 사라진(delisted) 장소 — 검색 중심점이 없으므로 건너뛴다.
                log.info("Plan emergency briefing skips missing place planId={} placeId={}", planId, item.targetId());
                continue;
            }
            List<EmergencyFacilityQueryResult> facilities = facilitiesByPlace.computeIfAbsent(
                item.targetId(),
                placeId -> emergencyFacilityQueryPort.findNearby(
                    point.lat(), point.lng(), SEARCH_RADIUS_METERS, FACILITIES_PER_SPOT));

            spotsByDay.computeIfAbsent(item.day(), day -> new java.util.ArrayList<>())
                .add(SpotEmergencyInfo.builder()
                    .planItemId(item.planItemId())
                    .placeId(item.targetId())
                    .title(item.title())
                    .facilities(facilities.stream().map(this::toFacilityInfo).toList())
                    .build());
        }

        List<DayEmergencyInfo> days = spotsByDay.entrySet().stream()
            .map(entry -> DayEmergencyInfo.builder()
                .day(entry.getKey())
                .spots(List.copyOf(entry.getValue()))
                .build())
            .toList();

        return PlanEmergencyInfo.builder()
            .planId(planId)
            .radiusMeters(SEARCH_RADIUS_METERS)
            .days(days)
            .build();
    }

    private FacilityInfo toFacilityInfo(EmergencyFacilityQueryResult facility) {
        return FacilityInfo.builder()
            .name(facility.name())
            .typeName(facility.typeName())
            .addr(facility.addr())
            .tel(facility.tel())
            .distanceMeters(facility.distanceMeters())
            .open24(facility.open24())
            .operatingHoursKnown(facility.operatingHoursKnown())
            .build();
    }
}

package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftDay;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftItem;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;

/**
 * 초안 동선을 좌표로 대조한다 — 그날 밤 숙소를 그날 끝과 다음 날 시작에 가까운 곳으로 옮긴다 (#1171).
 *
 * <p>숙소는 모델이 그날의 {@code lodging} 번호로 고르는데, 모델은 후보 사이의 거리를 본 적이 없다(프롬프트
 * 규칙 12). dev 실측에서 일정은 중문 · 애월 · 한경(서 · 남쪽)인데 숙소는 구좌(동쪽)라 숙소를 오가는 구간이
 * 35~62km 였다. 권역({@link JejuZone})을 프롬프트에 실어 모델이 덜 틀리게 하고, 그래도 틀리면 여기서 고친다 —
 * 서버는 좌표를 안다.
 *
 * <ul>
 *   <li><b>숙소만 옮긴다. 항목 순서는 바꾸지 않는다.</b> 순서에는 시간대가 실려 있다 — 점심 자리의 식당,
 *       "오전엔 바다, 오후엔 카페" 같은 요청. 거리만 보고 다시 늘어놓으면 그 뜻이 깨진다</li>
 *   <li><b>충분히 가까울 때만 옮긴다.</b> 모델 숙소가 가장 가까운 숙소보다 {@value #SWITCH_GAIN_METERS}m 이상
 *       멀 때만이다. 그 안이면 모델 선택을 존중한다 — 작은 이득에 숙소를 바꾸면 결과가 흔들린다</li>
 *   <li><b>옮길 때는 전날 숙소를 먼저 본다.</b> 전날 숙소도 충분히 가까우면 거기서 이어 묵는다 — 밤마다 짐을
 *       옮기는 일정은 반려견에게도 고되다</li>
 *   <li><b>사용자가 고른 숙소는 옮기지 않는다.</b> 필수 포함 · 선호 장소, 하루 재생성이면 기존 일정의 숙소다</li>
 * </ul>
 *
 * <p>마지막 날 숙박을 빼는 규칙은 {@link AiPlanDraftFactGuard} 의 것이다 — 그 뒤에 돌아야 마지막 날 숙박을
 * 옮기느라 거리를 재는 일이 없다.
 */
@Slf4j
final class AiPlanRouteGuard {

    /** 숙소를 옮길 만한 이득(직선거리 합). 이보다 작으면 모델 선택을 둔다. */
    static final double SWITCH_GAIN_METERS = 10_000d;

    /**
     * 긴 구간으로 셀 직선거리. FE 가 "하루 이동이 깁니다" 를 붙이는 구간과 같은 감각의 값이다 — 이 수가 늘면
     * 프롬프트가 아니라 후보 풀(권역별 숙소가 있는가)을 볼 신호다.
     */
    static final double LONG_LEG_METERS = 25_000d;

    /** 기존 일정 개요의 숙박 항목 종류. plan-service 가 enum 이름 그대로 내린다. */
    private static final String OUTLINE_LODGING_TYPE = PlanItemType.LODGING.name();

    private final Map<Long, PlaceCandidate> candidateById;
    /** 옮겨 갈 수 있는 숙소. 후보 목록 순서다 — 거리가 같으면 앞의 것(필수 포함이 맨 앞)을 고른다. */
    private final List<PlaceCandidate> stays;
    private final Set<Long> protectedPlaceIds;

    AiPlanRouteGuard(List<PlaceCandidate> candidates, Set<Long> protectedPlaceIds) {
        Map<Long, PlaceCandidate> byId = new LinkedHashMap<>();
        candidates.forEach(candidate -> byId.putIfAbsent(candidate.placeId(), candidate));
        this.candidateById = byId;
        this.stays = byId.values().stream()
            .filter(candidate -> AiPlanDraftFactGuard.LODGING_CONTENT_TYPE.equals(candidate.contentTypeName()))
            .filter(AiPlanRouteGuard::hasCoordinates)
            .toList();
        this.protectedPlaceIds = Set.copyOf(protectedPlaceIds);
    }

    /** 질의에서 만든다. 필수 포함 · 선호 장소와, 하루 재생성이면 기존 일정의 숙소를 지킨다. */
    static AiPlanRouteGuard of(AiPlanGenerationQuery query) {
        Set<Long> kept = new HashSet<>(query.safePinnedPlaceIds());
        kept.addAll(query.safeFavoritePlaceIds());
        if (query.planOutline() != null) {
            for (PlanOutline.PlanOutlineDay day : query.planOutline().safeDays()) {
                day.safeItems().stream()
                    .filter(item -> OUTLINE_LODGING_TYPE.equals(item.itemType()) && item.placeId() != null)
                    .forEach(item -> kept.add(item.placeId()));
            }
        }
        return new AiPlanRouteGuard(query.safeCandidates(), kept);
    }

    AiPlanDraft apply(AiPlanDraft draft) {
        List<AiPlanDraftDay> days = draft.days() == null ? List.of() : draft.days();
        List<AiPlanDraftDay> guarded = new ArrayList<>(days.size());
        int relocated = 0;
        for (int index = 0; index < days.size(); index++) {
            AiPlanDraftDay day = days.get(index);
            AiPlanDraftDay nextDay = index + 1 < days.size() && days.get(index + 1).day() == day.day() + 1
                ? days.get(index + 1) : null;
            PlaceCandidate previousStay = index > 0 && guarded.get(index - 1).day() == day.day() - 1
                ? stayOf(guarded.get(index - 1)) : null;
            AiPlanDraftDay kept = relocateStay(day, nextDay, previousStay);
            if (kept != day) {
                relocated++;
            }
            guarded.add(kept);
        }
        reportLegs(guarded, relocated);
        return AiPlanDraft.builder().days(guarded).reasons(draft.reasons()).build();
    }

    /**
     * 그날 밤 숙소를 옮긴다. 그날 마지막 항목이 숙박일 때만 그날 밤 숙소로 본다 — 어댑터가 {@code lodging} 번호를
     * 그 자리에 붙인다. 옮길 근거(좌표)가 하나라도 모자라면 그대로 둔다.
     */
    private AiPlanDraftDay relocateStay(AiPlanDraftDay day, AiPlanDraftDay nextDay, PlaceCandidate previousStay) {
        List<AiPlanDraftItem> items = itemsOf(day);
        PlaceCandidate current = stayOf(day);
        if (current == null || protectedPlaceIds.contains(current.placeId()) || stays.isEmpty()) {
            return day;
        }
        List<PlaceCandidate> anchors = anchors(items.subList(0, items.size() - 1), nextDay);
        if (anchors.isEmpty()) {
            return day;
        }

        PlaceCandidate best = stays.get(0);
        for (PlaceCandidate stay : stays) {
            if (cost(stay, anchors) < cost(best, anchors)) {
                best = stay;
            }
        }
        double currentCost = cost(current, anchors);
        double bestCost = cost(best, anchors);
        if (currentCost - bestCost < SWITCH_GAIN_METERS) {
            return day;
        }
        PlaceCandidate chosen = previousStay != null && cost(previousStay, anchors) - bestCost < SWITCH_GAIN_METERS
            ? previousStay : best;

        log.info("AI plan stay relocated day={} before={}({}) beforeKm={} after={}({}) afterKm={}",
            day.day(), current.placeId(), current.title(), km(currentCost),
            chosen.placeId(), chosen.title(), km(cost(chosen, anchors)));
        List<AiPlanDraftItem> relocated = new ArrayList<>(items.subList(0, items.size() - 1));
        relocated.add(AiPlanDraftItem.builder()
            .itemType(PlanItemType.LODGING)
            .placeId(chosen.placeId())
            .title(chosen.title())
            .note(AiPlanDraftFactGuard.LODGING_NOTE)
            .build());
        return AiPlanDraftDay.builder().day(day.day()).items(relocated).build();
    }

    /**
     * 숙소에서 이어지는 두 점 — 그날 마지막 장소와 다음 날 첫 장소. 좌표를 아는 것만 센다. 숙박 항목은 기준점이
     * 아니다 — 숙소를 옮기는 기준에 숙소를 넣으면 제자리를 맴돈다.
     */
    private List<PlaceCandidate> anchors(List<AiPlanDraftItem> todayBeforeStay, AiPlanDraftDay nextDay) {
        List<PlaceCandidate> anchors = new ArrayList<>(2);
        for (int index = todayBeforeStay.size() - 1; index >= 0; index--) {
            PlaceCandidate place = visitOf(todayBeforeStay.get(index));
            if (place != null) {
                anchors.add(place);
                break;
            }
        }
        if (nextDay != null) {
            for (AiPlanDraftItem item : itemsOf(nextDay)) {
                PlaceCandidate place = visitOf(item);
                if (place != null) {
                    anchors.add(place);
                    break;
                }
            }
        }
        return anchors;
    }

    /**
     * 구간을 직선거리로 세어 한 줄 남긴다 — 고치지 않고 센다. 전날 숙소 → 첫 항목, 항목 → 항목, 마지막 항목 →
     * 그날 숙소. 이슈의 "같은 조건으로 재생성해 구간 거리 비교" 를 dev 로그로 하는 자리라 0건이어도 남긴다.
     */
    private void reportLegs(List<AiPlanDraftDay> days, int relocated) {
        double maxLeg = 0d;
        int longLegs = 0;
        for (int index = 0; index < days.size(); index++) {
            AiPlanDraftDay day = days.get(index);
            PlaceCandidate from = index > 0 && days.get(index - 1).day() == day.day() - 1
                ? stayOf(days.get(index - 1)) : null;
            for (AiPlanDraftItem item : itemsOf(day)) {
                PlaceCandidate to = locatedOf(item);
                if (to == null) {
                    continue;
                }
                if (from != null) {
                    double leg = meters(from, to);
                    maxLeg = Math.max(maxLeg, leg);
                    if (leg >= LONG_LEG_METERS) {
                        longLegs++;
                    }
                }
                from = to;
            }
        }
        log.info("AI plan route legs maxLegKm={} longLegs={} lodgingRelocated={}", km(maxLeg), longLegs, relocated);
    }

    /** 그날 밤 숙소. 마지막 항목이 좌표를 아는 숙박일 때만이다. */
    private PlaceCandidate stayOf(AiPlanDraftDay day) {
        List<AiPlanDraftItem> items = itemsOf(day);
        if (items.isEmpty()) {
            return null;
        }
        AiPlanDraftItem last = items.get(items.size() - 1);
        return last.itemType() == PlanItemType.LODGING ? locatedOf(last) : null;
    }

    /** 숙박이 아닌, 좌표를 아는 항목의 장소. */
    private PlaceCandidate visitOf(AiPlanDraftItem item) {
        return item.itemType() == PlanItemType.LODGING ? null : locatedOf(item);
    }

    private PlaceCandidate locatedOf(AiPlanDraftItem item) {
        PlaceCandidate place = item.placeId() == null ? null : candidateById.get(item.placeId());
        return place != null && hasCoordinates(place) ? place : null;
    }

    private static List<AiPlanDraftItem> itemsOf(AiPlanDraftDay day) {
        return day.items() == null ? List.of() : day.items();
    }

    private static boolean hasCoordinates(PlaceCandidate place) {
        return place.lat() != null && place.lng() != null;
    }

    private static double cost(PlaceCandidate stay, List<PlaceCandidate> anchors) {
        return anchors.stream().mapToDouble(anchor -> meters(stay, anchor)).sum();
    }

    private static double meters(PlaceCandidate from, PlaceCandidate to) {
        return GeoDistance.meters(from.lat(), from.lng(), to.lat(), to.lng());
    }

    /** 로그용 km. 소수 첫째 자리면 구간을 가르기에 충분하다. */
    private static double km(double meters) {
        return Math.round(meters / 100d) / 10d;
    }
}

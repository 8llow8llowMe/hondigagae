package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.JejuZone;
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
 *   <li><b>항목 순서는 바꾸지 않는다.</b> 순서에는 시간대가 실려 있다 — 점심 자리의 식당,
 *       "오전엔 바다, 오후엔 카페" 같은 요청. 거리만 보고 다시 늘어놓으면 그 뜻이 깨진다</li>
 *   <li><b>충분히 가까울 때만 옮긴다.</b> 모델 숙소가 가장 가까운 숙소보다 {@value #SWITCH_GAIN_METERS}m 이상
 *       멀 때만이다. 그 안이면 모델 선택을 존중한다 — 작은 이득에 숙소를 바꾸면 결과가 흔들린다</li>
 *   <li><b>옮길 때는 전날 숙소를 먼저 본다.</b> 전날 숙소도 충분히 가까우면 거기서 이어 묵는다 — 밤마다 짐을
 *       옮기는 일정은 반려견에게도 고되다</li>
 *   <li><b>사용자가 고른 숙소는 옮기지 않는다.</b> 필수 포함 · 선호 장소, 하루 재생성이면 기존 일정의 숙소다</li>
 * </ul>
 *
 * <p><b>권역을 벗어난 방문지는 바꾼다 (#1334).</b> 숙소만 옮겨서는 그날 안의 흩어짐을 고칠 수 없다 — prod 2일차가
 * 애월 숙소 → 중문(남서부) → 선녀와나무꾼(북동부, 37.6km) 이었고, 숙소를 옮겨도 숙소까지 30.1km 가 남았다. 날마다 숙소를
 * 보기 <b>앞에</b> 그날의 방문지(장소 · 식사)를 대조하고, 숙소는 바꾼 결과를 기준점으로 고른다.
 *
 * <ul>
 *   <li><b>그날의 권역</b>은 다수결이다. 그날 좌표를 아는 방문지와 전날 숙소(투표만 하고 바꾸지 않는다)마다, 그 점의
 *       권역과 같거나 맞닿은 점의 수를 센다. 가장 많은 권역이고, 같으면 앞선 점(전날 숙소가 맨 앞)의 권역이다</li>
 *   <li><b>둘 다일 때만 벗어난 것이다</b> — 그날 권역과 같지도 맞닿지도 않고, 직전 점에서 {@value #LONG_LEG_METERS}m
 *       이상 멀다. 직전 점은 앞 방문지, 첫 방문지면 전날 숙소, 그것도 없으면 다음 방문지다. 권역은 구역이라 경계 양쪽의
 *       가까운 두 곳을 가를 수 있어서 거리로 한 번 더 거른다</li>
 *   <li><b>같은 자리 · 같은 종류로 바꾼다.</b> 일정 어디에도 없는 후보 중, 종류가 같고({@link AiPlanRepeatGuard#sameKind}),
 *       권역이 그날 권역과 같거나 맞닿고, 직전 점에서 {@value AiPlanRepeatGuard#REPLACE_WITHIN_METERS}m 안의 가장 가까운
 *       것이다. 원래 장소가 실내면 실내 후보를 먼저 본다 — 비 오는 날의 자리일 수 있다. 메모는 서버 문구다</li>
 *   <li><b>없으면 그대로 두고 경고한다.</b> 먼 곳으로 바꾸면 이탈보다 나쁜 동선이 된다. 필수 포함 · 선호 장소는 벗어나도
 *       바꾸지 않는다 — 사용자가 고른 곳이다</li>
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

    /** 기존 일정 개요의 산책 항목 종류. 아이디가 장소가 아니라 산책 코스 아이디라 교체 후보 제외에 넣지 않는다. */
    private static final String OUTLINE_WALK_TYPE = PlanItemType.WALK.name();

    private final Map<Long, PlaceCandidate> candidateById;
    /** 옮겨 갈 수 있는 숙소. 후보 목록 순서다 — 거리가 같으면 앞의 것(필수 포함이 맨 앞)을 고른다. */
    private final List<PlaceCandidate> stays;
    /** 권역 이탈 자리에 넣을 수 있는 좌표 있는 후보. 후보 목록 순서다 — 거리가 같으면 앞의 것을 고른다. */
    private final List<PlaceCandidate> located;
    private final Set<Long> protectedPlaceIds;
    /** 초안 밖에서 이미 일정에 있는 장소 — 하루 재생성이면 기존 일정의 장소다. 교체 후보로 쓰지 않는다. */
    private final Set<Long> scheduledElsewhere;

    AiPlanRouteGuard(List<PlaceCandidate> candidates, Set<Long> protectedPlaceIds) {
        this(candidates, protectedPlaceIds, Set.of());
    }

    AiPlanRouteGuard(List<PlaceCandidate> candidates, Set<Long> protectedPlaceIds, Set<Long> scheduledElsewhere) {
        Map<Long, PlaceCandidate> byId = new LinkedHashMap<>();
        candidates.forEach(candidate -> byId.putIfAbsent(candidate.placeId(), candidate));
        this.candidateById = byId;
        this.located = byId.values().stream().filter(AiPlanRouteGuard::hasCoordinates).toList();
        this.stays = located.stream()
            .filter(candidate -> AiPlanDraftFactGuard.LODGING_CONTENT_TYPE.equals(candidate.contentTypeName()))
            .toList();
        this.protectedPlaceIds = Set.copyOf(protectedPlaceIds);
        this.scheduledElsewhere = Set.copyOf(scheduledElsewhere);
    }

    /**
     * 질의에서 만든다. 필수 포함 · 선호 장소와, 하루 재생성이면 기존 일정의 숙소를 지킨다. 하루 재생성이면 기존 일정의
     * 장소는 교체 후보에서 뺀다 — 초안에는 다시 만드는 날만 있어서, 빼지 않으면 다른 날의 장소를 되풀이할 수 있다.
     */
    static AiPlanRouteGuard of(AiPlanGenerationQuery query) {
        Set<Long> kept = new HashSet<>(query.safePinnedPlaceIds());
        kept.addAll(query.safeFavoritePlaceIds());
        Set<Long> scheduled = new HashSet<>();
        if (query.planOutline() != null) {
            for (PlanOutline.PlanOutlineDay day : query.planOutline().safeDays()) {
                day.safeItems().stream()
                    .filter(item -> item.placeId() != null && !OUTLINE_WALK_TYPE.equals(item.itemType()))
                    .forEach(item -> {
                        scheduled.add(item.placeId());
                        if (OUTLINE_LODGING_TYPE.equals(item.itemType())) {
                            kept.add(item.placeId());
                        }
                    });
            }
        }
        return new AiPlanRouteGuard(query.safeCandidates(), kept, scheduled);
    }

    AiPlanDraft apply(AiPlanDraft draft) {
        List<AiPlanDraftDay> days = draft.days() == null ? List.of() : draft.days();
        Set<Long> used = new HashSet<>(scheduledElsewhere);
        days.forEach(day -> itemsOf(day).forEach(item -> {
            if (item.placeId() != null) {
                used.add(item.placeId());
            }
        }));
        List<AiPlanDraftDay> guarded = new ArrayList<>(days.size());
        int relocated = 0;
        int offZoneReplaced = 0;
        for (int index = 0; index < days.size(); index++) {
            AiPlanDraftDay original = days.get(index);
            AiPlanDraftDay nextDay = index + 1 < days.size() && days.get(index + 1).day() == original.day() + 1
                ? days.get(index + 1) : null;
            PlaceCandidate previousStay = index > 0 && guarded.get(index - 1).day() == original.day() - 1
                ? stayOf(guarded.get(index - 1)) : null;
            ZonedDay zoned = replaceOffZoneVisits(original, previousStay, used);
            offZoneReplaced += zoned.replaced();
            AiPlanDraftDay day = zoned.day();
            AiPlanDraftDay kept = relocateStay(day, nextDay, previousStay);
            if (kept != day) {
                relocated++;
            }
            guarded.add(kept);
        }
        reportLegs(guarded, relocated, offZoneReplaced);
        return AiPlanDraft.builder().days(guarded).reasons(draft.reasons()).build();
    }

    /**
     * 그날 권역을 벗어난 방문지를 같은 종류의 가까운 미사용 후보로 바꾼다 (#1334). 바꾼 장소는 {@code used} 에 넣는다 —
     * 다른 날의 교체가 같은 곳을 다시 고르지 않는다. 앞 항목을 바꿨으면 다음 항목의 직전 점은 바꾼 장소다.
     */
    private ZonedDay replaceOffZoneVisits(AiPlanDraftDay day, PlaceCandidate previousStay, Set<Long> used) {
        List<AiPlanDraftItem> items = new ArrayList<>(itemsOf(day));
        JejuZone dayZone = dayZone(items, previousStay);
        if (dayZone == null) {
            return new ZonedDay(day, 0);
        }
        int replaced = 0;
        for (int index = 0; index < items.size(); index++) {
            AiPlanDraftItem item = items.get(index);
            PlaceCandidate place = isVisit(item) ? locatedOf(item) : null;
            JejuZone zone = place == null ? null : zoneOf(place);
            if (zone == null || zone.adjacentTo(dayZone) || protectedPlaceIds.contains(place.placeId())) {
                continue;
            }
            PlaceCandidate reference = previousPoint(items, index, previousStay);
            if (reference == null) {
                reference = nextPoint(items, index);
            }
            if (reference == null || meters(reference, place) < LONG_LEG_METERS) {
                continue;
            }
            PlaceCandidate swap = nearestInZone(item, place, reference, dayZone, used);
            if (swap == null) {
                log.warn("AI plan off-zone visit kept - no unused candidate nearby day={} placeId={} title={} zone={} dayZone={} km={}",
                    day.day(), place.placeId(), place.title(), zone, dayZone, km(meters(reference, place)));
                continue;
            }
            used.add(swap.placeId());
            replaced++;
            log.info("AI plan off-zone visit replaced day={} before={}({}) after={}({}) km={}",
                day.day(), place.placeId(), place.title(), swap.placeId(), swap.title(), km(meters(reference, swap)));
            items.set(index, AiPlanDraftItem.builder()
                .itemType(item.itemType())
                .placeId(swap.placeId())
                .title(swap.title())
                .note(AiPlanDraftFactGuard.fallbackNote(swap))
                .build());
        }
        return replaced == 0 ? new ZonedDay(day, 0)
            : new ZonedDay(AiPlanDraftDay.builder().day(day.day()).items(items).build(), replaced);
    }

    /**
     * 그날의 권역 — 점마다 그 권역과 같거나 맞닿은 점의 수를 세어 가장 많은 권역이다. 같으면 앞선 점의 권역이다. 전날
     * 숙소가 맨 앞 점이다 — 다음 날은 전날 숙소 근처에서 시작한다(프롬프트 규칙 2). 권역을 아는 점이 없으면 null 이다.
     */
    private JejuZone dayZone(List<AiPlanDraftItem> items, PlaceCandidate previousStay) {
        List<JejuZone> zones = new ArrayList<>(items.size() + 1);
        if (previousStay != null && zoneOf(previousStay) != null) {
            zones.add(zoneOf(previousStay));
        }
        for (AiPlanDraftItem item : items) {
            PlaceCandidate place = isVisit(item) ? locatedOf(item) : null;
            if (place != null && zoneOf(place) != null) {
                zones.add(zoneOf(place));
            }
        }
        JejuZone best = null;
        long bestVotes = 0;
        for (JejuZone zone : zones) {
            long votes = zones.stream().filter(other -> other.adjacentTo(zone)).count();
            if (votes > bestVotes) {
                best = zone;
                bestVotes = votes;
            }
        }
        return best;
    }

    /** 앞 방문지 중 좌표를 아는 가장 가까운 것, 없으면 전날 숙소. */
    private PlaceCandidate previousPoint(List<AiPlanDraftItem> items, int index, PlaceCandidate previousStay) {
        for (int before = index - 1; before >= 0; before--) {
            PlaceCandidate place = isVisit(items.get(before)) ? locatedOf(items.get(before)) : null;
            if (place != null) {
                return place;
            }
        }
        return previousStay;
    }

    /** 첫 날 · 전날 숙소를 모르는 날의 첫 방문지는 다음 방문지에 견준다 — 그 방문지에서 이어지는 구간이다. */
    private PlaceCandidate nextPoint(List<AiPlanDraftItem> items, int index) {
        for (int after = index + 1; after < items.size(); after++) {
            PlaceCandidate place = isVisit(items.get(after)) ? locatedOf(items.get(after)) : null;
            if (place != null) {
                return place;
            }
        }
        return null;
    }

    /** 원래 장소가 실내면 실내 후보를 먼저 찾고, 없으면 실내외를 가리지 않는다. */
    private PlaceCandidate nearestInZone(AiPlanDraftItem item, PlaceCandidate original, PlaceCandidate reference,
                                         JejuZone dayZone, Set<Long> used) {
        if (Boolean.TRUE.equals(original.indoor())) {
            PlaceCandidate indoor = nearestInZone(item, reference, dayZone, used, true);
            if (indoor != null) {
                return indoor;
            }
        }
        return nearestInZone(item, reference, dayZone, used, false);
    }

    private PlaceCandidate nearestInZone(AiPlanDraftItem item, PlaceCandidate reference, JejuZone dayZone, Set<Long> used,
                                         boolean indoorOnly) {
        PlaceCandidate best = null;
        double bestMeters = AiPlanRepeatGuard.REPLACE_WITHIN_METERS;
        for (PlaceCandidate candidate : located) {
            if (used.contains(candidate.placeId()) || !AiPlanRepeatGuard.sameKind(item, candidate)
                || (indoorOnly && !Boolean.TRUE.equals(candidate.indoor())) || !dayZone.adjacentTo(zoneOf(candidate))) {
                continue;
            }
            double distance = meters(reference, candidate);
            if (distance <= bestMeters && (best == null || distance < bestMeters)) {
                best = candidate;
                bestMeters = distance;
            }
        }
        return best;
    }

    /** 권역 대조를 거친 날과 바꾼 방문지 수. 바꾼 것이 없으면 받은 날 그대로다. */
    private record ZonedDay(AiPlanDraftDay day, int replaced) {
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
    private void reportLegs(List<AiPlanDraftDay> days, int relocated, int offZoneReplaced) {
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
        log.info("AI plan route legs maxLegKm={} longLegs={} lodgingRelocated={} offZoneReplaced={}",
            km(maxLeg), longLegs, relocated, offZoneReplaced);
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

    /**
     * 권역 대조의 대상인 방문지(장소 · 식사)인가. 숙박은 숙소 재배치가 맡고, 산책({@code WALK})의 아이디는 장소가 아니라
     * 산책 코스 아이디라 후보와 맞춰 보면 엉뚱한 장소가 된다.
     */
    private static boolean isVisit(AiPlanDraftItem item) {
        return item.itemType() == PlanItemType.PLACE || item.itemType() == PlanItemType.MEAL;
    }

    private static JejuZone zoneOf(PlaceCandidate place) {
        return JejuZone.of(place.lat(), place.lng());
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

package com.hondigagae.domainlayer.planner.application.service;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.JejuZone;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.application.model.RequestNoteConstraints;
import com.hondigagae.domainlayer.planner.application.model.RequestedRegion;
import com.hondigagae.domainlayer.planner.application.service.CandidateZonePolicy.Kind;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftDay;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftItem;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftReason;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;

/**
 * 명시 요청(실내 · 카페 · 지역)을 생성된 초안에 맞추고, 맞췄는지를 근거 맨 앞에서 말한다 (#1170 · #1423).
 *
 * <p>전에는 후보 풀에 실내 카페가 <b>있기만 하면</b> 충족으로 쳤다(#1170) — 초안에 날마다 들어갔는지는 보지 않았다. 모델
 * 근거가 사실 대조에서 모두 버려지면 근거가 0개라 요청을 반영했는지 말하는 문장도 없었다. <b>추가 LLM 호출 · 재시도 없이</b>
 * 서버가 장소 데이터로 확인되는 것만 결정적으로 고친다.
 *
 * <ul>
 *   <li><b>실내 · 카페 — 빠진 날에 넣기만 한다.</b> 빼거나 바꾸지 않는다 — 모델이 고른 장소에는 서버가 못 읽는 요청
 *       ("오전엔 바다 보며 산책")이 실려 있을 수 있다. 그래서 그날 방문지가 하나 늘 수 있다</li>
 *   <li><b>지역 — 고친 결과를 세어 말하기만 한다.</b> 장소를 옮기는 일은 후보 풀({@link CandidateZonePolicy#focus})과
 *       프롬프트가 한다</li>
 *   <li><b>근거는 서버 문장을 맨 앞에 둔다.</b> 실내 · 카페를 맞추지 못했으면 넣었다고 말하는 모델 근거는 뺀다</li>
 * </ul>
 */
@Slf4j
public final class RequestNoteDraftPolicy {

    /**
     * 근거 개수 상한. 프롬프트 규칙 4 · {@code OllamaLlmAdapter} 의 상한과 같다.
     * 서버 문장이 잘려 나가지 않게 그 문장을 앞에 두고 여기서 다시 자른다.
     */
    static final int MAX_REASONS = 3;

    /** 요청을 맞췄다. 화면 이름은 둘 다 {@link #REASON_NAME} 이다 — 코드만 내보내면 {@code REQUEST_APPLIED} 가 그대로 보인다. */
    static final String APPLIED_CODE = "REQUEST_APPLIED";
    static final String UNMET_CODE = "REQUEST_UNMET";
    static final String REASON_NAME = "요청 반영";

    /**
     * 빠진 날에 넣을 장소의 거리 한도. 그날 항목(숙박 포함) 중 가장 가까운 점에서 이 안이어야 한다. 권역 이탈 방문지를
     * 바꾸는 거리({@code AiPlanRouteGuard})와 같다 — 더 먼 곳을 넣으면 요청을 맞추는 대신 동선을 깬다.
     */
    static final double FILL_WITHIN_METERS = 20_000d;

    private RequestNoteDraftPolicy() {
    }

    /**
     * 초안을 요청에 맞춘다. 실내 · 카페도 지역도 묻지 않았으면 초안 그대로다. 하루 재생성은 지역을 보지 않는다 — 기존 일정이
     * 앞뒤 동선을 정하고, 워커도 그 요청의 후보 풀을 지역으로 좁히지 않았다.
     */
    public static AiPlanDraft apply(AiPlanDraft draft, AiPlanGenerationQuery query) {
        RequestNoteConstraints constraints = RequestNoteConstraints.from(query.requestNote());
        RequestedRegion region = query.regenerateDay() == null
            ? RequestedRegion.from(query.requestNote())
            : RequestedRegion.NONE;
        if (!constraints.asksAnything() && !region.asksAnything()) {
            return draft;
        }

        Map<Long, PlaceCandidate> candidates = index(query.safeCandidates());
        List<AiPlanDraftDay> days = draft.days();
        List<AiPlanDraftReason> serverReasons = new ArrayList<>();
        boolean constraintUnmet = false;
        if (constraints.asksAnything()) {
            Fill fill = fillRequested(days == null ? List.of() : days, query, candidates, constraints);
            if (fill.filledDays() > 0) {
                days = fill.days();
            }
            if (fill.reason() != null) {
                serverReasons.add(fill.reason());
                constraintUnmet = UNMET_CODE.equals(fill.reason().code());
            }
        }
        if (region.asksAnything()) {
            AiPlanDraftReason regionReason = regionReason(days == null ? List.of() : days, candidates, region);
            if (regionReason != null) {
                serverReasons.add(regionReason);
            }
        }
        if (serverReasons.isEmpty() && days == draft.days()) {
            return draft;
        }

        List<AiPlanDraftReason> reasons = new ArrayList<>(serverReasons);
        for (AiPlanDraftReason reason : draft.reasons() == null ? List.<AiPlanDraftReason>of() : draft.reasons()) {
            if (reasons.size() >= MAX_REASONS) {
                break;
            }
            if (constraintUnmet && claimsSatisfied(reason.description(), constraints)) {
                continue;
            }
            reasons.add(reason);
        }
        log.info("AI plan request note applied cafe={} indoor={} regionWords={} regionZones={} serverReasons={}",
            constraints.cafe(), constraints.indoor(), region.words(), region.zones(),
            serverReasons.stream().map(AiPlanDraftReason::code).toList());
        return AiPlanDraft.builder().days(days).reasons(List.copyOf(reasons)).build();
    }

    /**
     * 실내 · 카페가 빠진 날에 맞는 후보를 넣는다. 방문 항목(장소 · 식사)이 하나도 없는 날은 보지 않는다.
     *
     * <ul>
     *   <li>후보 풀에 맞는 장소가 아예 없으면 넣을 수 없다 — "이번 후보에 없어요"(#1170 문구 그대로)</li>
     *   <li>그날 항목(숙박 포함) 중 가장 가까운 점까지 {@link #FILL_WITHIN_METERS} 안인, 아직 쓰지 않은 가장 가까운 후보를
     *       고른다. 거리가 같으면 후보 목록 앞의 것이다</li>
     *   <li><b>20km 를 잰 그 항목(기준점) 바로 뒤에 넣는다.</b> 기준점이 숙박이면 그 숙박 바로 앞이다 — 숙박은 그날 끝에
     *       남는다. 전에는 첫 방문 뒤에 넣어서, 협재 → 애월 → 동문시장 → 숙소 인 날 동문시장에서 13.5km 인 함덕 실내 장소가
     *       협재 바로 뒤에 들어가 43km · 35km 구간을 만들었다. 기준점이 어디든 첫 방문보다 앞에는 들어가지 않는다</li>
     *   <li>쓴 장소는 초안 전체와, 하루 재생성이면 기존 일정의 장소다. 넣은 장소는 다음 날 후보에서 뺀다 — 규칙 11
     *       (같은 장소를 여러 날에 넣지 않는다)을 서버가 깨지 않게</li>
     * </ul>
     */
    private static Fill fillRequested(
        List<AiPlanDraftDay> days, AiPlanGenerationQuery query, Map<Long, PlaceCandidate> candidates,
        RequestNoteConstraints constraints
    ) {
        List<PlaceCandidate> matching = query.safeCandidates().stream()
            .filter(constraints::matches)
            // 카페만 요청하면 분류만 본다 — 분류가 카페인 숙소가 있어도 그 요청을 대신하지 않는다
            .filter(candidate -> !Kind.LODGING.matches(candidate))
            .toList();
        if (matching.isEmpty()) {
            return new Fill(days, reason(UNMET_CODE, unmetDescription(constraints)), 0);
        }

        Set<Long> used = usedPlaceIds(days, query);
        List<AiPlanDraftDay> result = new ArrayList<>(days.size());
        List<Integer> unmetDays = new ArrayList<>();
        int checkedDays = 0;
        int filledDays = 0;
        for (AiPlanDraftDay day : days) {
            List<AiPlanDraftItem> items = day.items() == null ? List.of() : day.items();
            int firstVisit = firstVisitIndex(items);
            if (firstVisit < 0) {
                result.add(day);
                continue;
            }
            checkedDays++;
            boolean satisfied = items.stream()
                .filter(RequestNoteDraftPolicy::isVisit)
                .map(item -> candidates.get(item.placeId()))
                .anyMatch(candidate -> candidate != null && constraints.matches(candidate));
            if (satisfied) {
                result.add(day);
                continue;
            }
            Nearest nearest = nearestUnused(matching, items, candidates, used);
            if (nearest == null) {
                unmetDays.add(day.day());
                result.add(day);
                continue;
            }
            used.add(nearest.candidate().placeId());
            List<AiPlanDraftItem> filled = new ArrayList<>(items);
            filled.add(insertionIndex(items, nearest.anchorIndex(), firstVisit), toItem(nearest.candidate(), constraints));
            result.add(AiPlanDraftDay.builder().day(day.day()).items(List.copyOf(filled)).build());
            filledDays++;
            log.info("AI plan requested place filled day={} placeId={} title={} meters={} anchorPlaceId={}",
                day.day(), nearest.candidate().placeId(), nearest.candidate().title(), Math.round(nearest.meters()),
                items.get(nearest.anchorIndex()).placeId());
        }
        if (!unmetDays.isEmpty()) {
            log.warn("AI plan requested place not filled - no unused candidate nearby unmetDays={} withinMeters={}",
                unmetDays, Math.round(FILL_WITHIN_METERS));
        }
        if (checkedDays == 0) {
            return new Fill(days, null, 0);
        }
        AiPlanDraftReason reason = unmetDays.isEmpty()
            ? reason(APPLIED_CODE, appliedDescription(constraints, checkedDays))
            : reason(UNMET_CODE, unfilledDescription(constraints, unmetDays));
        return new Fill(List.copyOf(result), reason, filledDays);
    }

    /**
     * 넣을 자리 — 기준점 바로 뒤, 기준점이 숙박이면 그 바로 앞. 첫 방문보다 앞에는 두지 않는다(숙박이 맨 끝이 아닌
     * 초안이 오더라도).
     */
    private static int insertionIndex(List<AiPlanDraftItem> items, int anchorIndex, int firstVisit) {
        int index = items.get(anchorIndex).itemType() == PlanItemType.LODGING ? anchorIndex : anchorIndex + 1;
        return Math.max(index, firstVisit + 1);
    }

    /**
     * 요청 지역을 맞췄는가. 권역을 아는 방문 항목 중 <b>요청 권역 자체가 절반 이상</b>이면 맞췄다. 맞닿은 권역은 세지
     * 않는다 — 성산을 요청했는데 북부(제주 시내)만 돌아도 "위주로 골랐어요" 가 되면 안 된다. 숙박은 세지 않는다(그날 밤 묵는
     * 곳이라 숙소 재배치가 거리로 정한다). 방문 항목이 없으면 말할 것이 없다.
     *
     * <p>못 맞췄을 때 원인을 단정하지 않는다 — 후보가 모자랐는지 모델이 다른 곳을 골랐는지 이 자리에서는 가를 수 없다.
     */
    private static AiPlanDraftReason regionReason(
        List<AiPlanDraftDay> days, Map<Long, PlaceCandidate> candidates, RequestedRegion region
    ) {
        Set<JejuZone> reach = region.reach();
        int visits = 0;
        int inZones = 0;
        int inReach = 0;
        for (AiPlanDraftDay day : days) {
            for (AiPlanDraftItem item : day.items() == null ? List.<AiPlanDraftItem>of() : day.items()) {
                PlaceCandidate candidate = isVisit(item) ? candidates.get(item.placeId()) : null;
                JejuZone zone = candidate == null ? null : JejuZone.of(candidate.lat(), candidate.lng());
                if (zone == null) {
                    continue;
                }
                visits++;
                inZones += region.zones().contains(zone) ? 1 : 0;
                inReach += reach.contains(zone) ? 1 : 0;
            }
        }
        log.info("AI plan requested region checked words={} zones={} visits={} inZones={} inReach={}",
            region.words(), region.zones(), visits, inZones, inReach);
        if (visits == 0) {
            return null;
        }
        if (inZones * 2 >= visits) {
            return reason(APPLIED_CODE, "요청하신 지역(" + region.label() + ") 위주로 골랐어요.");
        }
        return reason(UNMET_CODE, "요청하신 지역(" + region.label() + ") 밖의 장소도 함께 넣었어요.");
    }

    /**
     * 그날 항목(숙박 포함) 중 가장 가까운 점까지 한도 안인, 쓰지 않은 가장 가까운 후보와 그 점(기준점)의 자리. 없으면 null.
     * 한 후보에 같은 거리의 항목이 둘이면 앞의 항목이 기준점이다.
     */
    private static Nearest nearestUnused(
        List<PlaceCandidate> matching, List<AiPlanDraftItem> items, Map<Long, PlaceCandidate> candidates, Set<Long> used
    ) {
        Nearest best = null;
        for (PlaceCandidate candidate : matching) {
            if (used.contains(candidate.placeId()) || candidate.lat() == null || candidate.lng() == null) {
                continue;
            }
            double meters = Double.MAX_VALUE;
            int anchorIndex = -1;
            for (int index = 0; index < items.size(); index++) {
                PlaceCandidate point = candidates.get(items.get(index).placeId());
                if (point == null || point.lat() == null || point.lng() == null) {
                    continue;
                }
                double distance = GeoDistance.meters(point.lat(), point.lng(), candidate.lat(), candidate.lng());
                if (distance < meters) {
                    meters = distance;
                    anchorIndex = index;
                }
            }
            // 같은 거리면 앞의 후보 — 엄격히 가까울 때만 바꾼다
            if (anchorIndex >= 0 && meters <= FILL_WITHIN_METERS && (best == null || meters < best.meters())) {
                best = new Nearest(candidate, meters, anchorIndex);
            }
        }
        return best;
    }

    /**
     * 초안 전체와, 하루 재생성이면 기존 일정에 이미 있는 장소. 기존 일정의 산책({@code WALK}) 항목은 뺀다 — 그 아이디는
     * {@code walk_course.id} 라 장소 아이디와 겹쳐도 다른 것이다({@code AiPlanRouteGuard.of} 와 같다).
     */
    private static Set<Long> usedPlaceIds(List<AiPlanDraftDay> days, AiPlanGenerationQuery query) {
        Set<Long> used = new HashSet<>();
        for (AiPlanDraftDay day : days) {
            for (AiPlanDraftItem item : day.items() == null ? List.<AiPlanDraftItem>of() : day.items()) {
                if (item.placeId() != null) {
                    used.add(item.placeId());
                }
            }
        }
        PlanOutline outline = query.planOutline();
        if (query.regenerateDay() != null && outline != null) {
            outline.safeDays().stream()
                .flatMap(day -> day.safeItems().stream())
                .filter(item -> item.placeId() != null && !PlanItemType.WALK.name().equals(item.itemType()))
                .map(PlanOutline.PlanOutlineItem::placeId)
                .forEach(used::add);
        }
        return used;
    }

    /** 넣는 항목. 종류는 후보 분류가 정하고(음식점 → 식사, 그 밖 → 장소), 메모는 서버 문구다 — 모델이 쓴 적 없는 장소다. */
    private static AiPlanDraftItem toItem(PlaceCandidate candidate, RequestNoteConstraints constraints) {
        return AiPlanDraftItem.builder()
            .itemType(Kind.RESTAURANT.matches(candidate) ? PlanItemType.MEAL : PlanItemType.PLACE)
            .placeId(candidate.placeId())
            .title(candidate.title())
            .note(filledNote(constraints))
            .build();
    }

    private static int firstVisitIndex(List<AiPlanDraftItem> items) {
        for (int index = 0; index < items.size(); index++) {
            if (isVisit(items.get(index))) {
                return index;
            }
        }
        return -1;
    }

    /** 방문 항목 — 장소 · 식사. 숙박은 그날 밤 묵는 곳이라 요청 장소도 지역 판정 대상도 아니다. */
    private static boolean isVisit(AiPlanDraftItem item) {
        return item.placeId() != null && (item.itemType() == PlanItemType.PLACE || item.itemType() == PlanItemType.MEAL);
    }

    private static Map<Long, PlaceCandidate> index(List<PlaceCandidate> candidates) {
        Map<Long, PlaceCandidate> byId = new HashMap<>();
        candidates.forEach(candidate -> byId.putIfAbsent(candidate.placeId(), candidate));
        return byId;
    }

    private static AiPlanDraftReason reason(String code, String description) {
        return AiPlanDraftReason.builder().code(code).name(REASON_NAME).description(description).build();
    }

    /** 요청한 것의 이름 — 문장 안에서 부르는 말. 셋 다 모음으로 끝나 뒤에 "를" 이 붙는다. */
    private static String requestedName(RequestNoteConstraints constraints) {
        if (constraints.cafe() && constraints.indoor()) {
            return "실내 카페";
        }
        return constraints.cafe() ? "카페" : "실내 장소";
    }

    /** 후보 풀에 맞는 장소가 아예 없다 (#1170 문구 그대로). */
    private static String unmetDescription(RequestNoteConstraints constraints) {
        return "요청하신 " + requestedName(constraints) + "가 이번 후보에 없어요.";
    }

    private static String appliedDescription(RequestNoteConstraints constraints, int checkedDays) {
        return checkedDays > 1
            ? "요청하신 " + requestedName(constraints) + "를 날마다 넣었어요."
            : "요청하신 " + requestedName(constraints) + "를 넣었어요.";
    }

    private static String unfilledDescription(RequestNoteConstraints constraints, List<Integer> unmetDays) {
        String dayLabels = unmetDays.stream().map(day -> day + "일차").collect(Collectors.joining(" · "));
        return "요청하신 " + requestedName(constraints) + "를 " + dayLabels + "에는 넣지 못했어요. 그날 동선 근처에 맞는 후보가 없었어요.";
    }

    private static String filledNote(RequestNoteConstraints constraints) {
        return "요청하신 " + requestedName(constraints) + "예요.";
    }

    /** 요청을 넣었다고 말하는 근거인가 — 카페 · 실내 · 휴식 장소. 맞추지 못했을 때 뺀다 (#1170). */
    private static boolean claimsSatisfied(String description, RequestNoteConstraints constraints) {
        if (description == null) {
            return false;
        }
        if (description.contains("휴식 장소")) {
            return true;
        }
        if (constraints.cafe() && description.contains("카페")) {
            return true;
        }
        return constraints.indoor() && description.contains("실내");
    }

    /**
     * 실내 · 카페를 맞춘 결과.
     *
     * @param days       넣은 뒤의 일정. 넣은 날이 없으면 받은 그대로다
     * @param reason     서버 근거. 방문 항목이 있는 날이 없으면 null — 말할 것이 없다
     * @param filledDays 넣은 날 수
     */
    private record Fill(List<AiPlanDraftDay> days, AiPlanDraftReason reason, int filledDays) {
    }

    /**
     * 넣을 후보와 그 거리.
     *
     * @param anchorIndex 20km 를 잰 그날 항목(기준점)의 자리. 넣는 자리를 이것으로 정한다
     */
    private record Nearest(PlaceCandidate candidate, double meters, int anchorIndex) {
    }
}

package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
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
 * 다른 날에 이미 나온 장소를 같은 종류의 가까운 미사용 후보로 바꾼다 (#1254).
 *
 * <p>프롬프트 규칙 11이 "같은 장소를 여러 날에 넣지 않는다" 고 하지만 모델은 어긴다 — dev 에서 3일 일정의 3일차가
 * 2일차의 중문색달해수욕장 · 애견카페왈 사계점을 그대로 되풀이했다(5번 생성 중 2번). #570 은 "무엇으로 메울지 어댑터가
 * 모른다" 며 경고만 남겼는데, 이제는 후보마다 좌표와 종류를 알고 풀에 권역별 선택지가 있다(#1236 · #1245). 반복된
 * 자리에 <b>같은 종류에서 가장 가까운, 아직 안 쓴 후보</b>를 넣는다.
 *
 * <ul>
 *   <li><b>숙박은 반복이 아니다.</b> 같은 숙소에 이어 묵는 것이 정상이다</li>
 *   <li><b>종류를 지킨다.</b> 식사 자리({@code MEAL})에는 음식점을, 장소 자리에는 숙박도 음식점도 아닌 후보를 넣는다 —
 *       점심 자리에 오름이 들어가면 그날의 모양이 깨진다</li>
 *   <li><b>가까운 것만.</b> 반복된 장소에서 {@value #REPLACE_WITHIN_METERS}m 안에 쓸 후보가 없으면 그대로 두고 경고한다 —
 *       먼 곳으로 바꾸면 반복보다 나쁜 동선이 된다</li>
 *   <li><b>메모는 서버 문구다</b> ({@link AiPlanDraftFactGuard#fallbackNote}). 모델의 메모는 원래 장소를 두고 쓴 문장이다</li>
 * </ul>
 *
 * <p>사실 대조 다음, 동선 대조 앞에 돈다 — 바꾼 장소로 구간을 재야 한다.
 */
@Slf4j
final class AiPlanRepeatGuard {

    /** 바꿔 넣을 후보를 찾는 거리. 같은 권역이나 맞닿은 권역 안쪽이다. */
    static final double REPLACE_WITHIN_METERS = 20_000d;

    /** 후보 목록 순서 — 거리가 같으면 앞의 것(필수 포함 · 요청 조건이 앞)을 고른다. */
    private final List<PlaceCandidate> candidates;
    private final Map<Long, PlaceCandidate> candidateById;

    AiPlanRepeatGuard(List<PlaceCandidate> candidates) {
        Map<Long, PlaceCandidate> byId = new LinkedHashMap<>();
        candidates.forEach(candidate -> byId.putIfAbsent(candidate.placeId(), candidate));
        this.candidateById = byId;
        this.candidates = List.copyOf(byId.values());
    }

    AiPlanDraft apply(AiPlanDraft draft) {
        List<AiPlanDraftDay> days = draft.days() == null ? List.of() : draft.days();
        Set<Long> used = new HashSet<>();
        days.forEach(day -> itemsOf(day).forEach(item -> {
            if (item.placeId() != null) {
                used.add(item.placeId());
            }
        }));

        Set<Long> seen = new HashSet<>();
        int replaced = 0;
        int kept = 0;
        List<AiPlanDraftDay> guarded = new ArrayList<>(days.size());
        for (AiPlanDraftDay day : days) {
            List<AiPlanDraftItem> items = new ArrayList<>();
            Set<Long> today = new HashSet<>();
            boolean changed = false;
            for (AiPlanDraftItem item : itemsOf(day)) {
                if (!isRepeat(item, seen)) {
                    items.add(item);
                    if (item.placeId() != null) {
                        today.add(item.placeId());
                    }
                    continue;
                }
                PlaceCandidate original = candidateById.get(item.placeId());
                PlaceCandidate swap = nearestUnused(item, original, used);
                if (swap == null) {
                    kept++;
                    log.warn("AI plan repeated place kept - no unused candidate nearby day={} placeId={} title={}",
                        day.day(), item.placeId(), item.title());
                    items.add(item);
                    today.add(item.placeId());
                    continue;
                }
                replaced++;
                changed = true;
                used.add(swap.placeId());
                today.add(swap.placeId());
                log.info("AI plan repeated place replaced day={} before={}({}) after={}({}) km={}",
                    day.day(), item.placeId(), item.title(), swap.placeId(), swap.title(),
                    Math.round(meters(original, swap) / 100d) / 10d);
                items.add(AiPlanDraftItem.builder()
                    .itemType(item.itemType())
                    .placeId(swap.placeId())
                    .title(swap.title())
                    .note(AiPlanDraftFactGuard.fallbackNote(swap))
                    .build());
            }
            seen.addAll(today);
            guarded.add(changed ? AiPlanDraftDay.builder().day(day.day()).items(items).build() : day);
        }
        if (replaced + kept > 0) {
            log.info("AI plan repeated places replaced={} kept={}", replaced, kept);
        }
        return AiPlanDraft.builder().days(guarded).reasons(draft.reasons()).build();
    }

    /** 앞선 날에 나온 숙박 아닌 장소인가. 같은 날 안의 되풀이는 모델이 순서를 뜻한 것일 수 있어 보지 않는다. */
    private static boolean isRepeat(AiPlanDraftItem item, Set<Long> seenOnEarlierDays) {
        return item.itemType() != PlanItemType.LODGING
            && item.placeId() != null
            && seenOnEarlierDays.contains(item.placeId());
    }

    /** 같은 종류에서 반복된 장소에 가장 가까운, 일정에 없는 후보. 거리 안에 없거나 좌표를 모르면 null 이다. */
    private PlaceCandidate nearestUnused(AiPlanDraftItem item, PlaceCandidate original, Set<Long> used) {
        if (original == null || !hasCoordinates(original)) {
            return null;
        }
        PlaceCandidate best = null;
        double bestMeters = REPLACE_WITHIN_METERS;
        for (PlaceCandidate candidate : candidates) {
            if (used.contains(candidate.placeId()) || !hasCoordinates(candidate) || !sameKind(item, candidate)) {
                continue;
            }
            double distance = meters(original, candidate);
            if (distance <= bestMeters && (best == null || distance < bestMeters)) {
                best = candidate;
                bestMeters = distance;
            }
        }
        return best;
    }

    /** 식사 자리는 음식점으로, 장소 자리는 숙박도 음식점도 아닌 후보로. */
    private static boolean sameKind(AiPlanDraftItem item, PlaceCandidate candidate) {
        String type = candidate.contentTypeName();
        boolean restaurant = AiPlanDraftFactGuard.RESTAURANT_CONTENT_TYPE.equals(type);
        boolean lodging = AiPlanDraftFactGuard.LODGING_CONTENT_TYPE.equals(type);
        return item.itemType() == PlanItemType.MEAL ? restaurant : !restaurant && !lodging;
    }

    private static List<AiPlanDraftItem> itemsOf(AiPlanDraftDay day) {
        return day.items() == null ? List.of() : day.items();
    }

    private static boolean hasCoordinates(PlaceCandidate place) {
        return place.lat() != null && place.lng() != null;
    }

    private static double meters(PlaceCandidate from, PlaceCandidate to) {
        return GeoDistance.meters(from.lat(), from.lng(), to.lat(), to.lng());
    }
}

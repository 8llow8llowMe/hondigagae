package com.hondigagae.domainlayer.planner.application.service;

import com.hondigagae.domainlayer.planner.application.model.JejuZone;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.RequestNoteConstraints;
import com.hondigagae.domainlayer.planner.application.model.RequestedRegion;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 후보 풀에 숙박 · 음식점을 권역마다 고르게 싣는다 (#1236 숙박 · #1245 음식점).
 *
 * <p>후보 풀은 지역 검색 상위 N(`placeId` 순)이라 숙박 · 음식점이 우연히만 든다. dev 의 제주 전체 50곳에는 숙박이
 * 3곳뿐이었고(#1236) 음식점은 0곳이었다 — 동반 가능 숙박 56곳 · 음식점 126곳이 6권역에 다 있는데도. 숙박을 싣고 나서
 * 재측정하니 25km 넘는 구간 3개 중 2개가 식사 자리였다(#1245) — 카페 요청(#1170)으로 들어온 8곳 중 5곳이 북서부라
 * 남서부 · 남부 일정의 식사가 북쪽으로 오갔다.
 *
 * <ul>
 *   <li><b>종류마다 권역당 정해진 수까지</b> ({@link Kind#perZone}). 이미 풀에 있는 같은 종류도 그 권역 몫으로 센다.
 *       권역은 프롬프트와 같은 {@link JejuZone} 이다 — 둘이 다른 지도를 보면 안 된다</li>
 *   <li><b>상한은 그대로다.</b> 넘치는 만큼 풀의 <b>뒤에서부터 숙박도 음식점도 아닌 장소</b>(일반 검색의 꼬리)를
 *       뺀다. 앞에는 요청 조건 장소가 있다(#1170). 권역마다 실은 숙박 · 음식점은 서로를 밀어내지 않는다</li>
 *   <li><b>권역을 모르는 후보는 싣지 않는다.</b> 좌표가 없거나 제주 밖이면 어느 권역 몫인지 모른다</li>
 * </ul>
 *
 * <p><b>제주 전체 일정은 방문 장소도 권역마다 하한을 둔다 (#1312)</b> — {@link #ensureVisits}. 권역 순서 제안이 남동부에
 * 날을 줘도 풀에 남동부 방문 후보가 없으면 모델이 다른 권역으로 그날을 채웠다. 하한을 지키는 방문 장소는 숙박 · 음식점을
 * 실을 때도 덜어 내지 않는다({@code visitFloor}).
 *
 * <p><b>요청 지역이 있으면 마지막에 그 권역 위주로 좁힌다 (#1423)</b> — {@link #focus}. 고르게 깐 풀은 "성산 쪽 위주로"
 * 같은 요청에도 섬 전체를 내밀었다.
 *
 * <p>필수 포함 · 즐겨찾기는 이 다음에 워커가 합친다 — 그 장소는 상한과 무관하게 들어가야 하므로 여기서 세지 않는다.
 */
public final class CandidateZonePolicy {

    /**
     * 권역마다 싣는 후보 종류. 분류 이름({@code contentTypeName})으로 가른다.
     *
     * <p>둘 다 권역당 2곳 — 6권역이면 종류마다 많아야 12곳, 합쳐 24곳이 상한 50의 꼬리를 덜어 낸다. 관광지 등 나머지가
     * 26곳 이상 남아 하루 1~3곳을 고르기에 넉넉하다.
     */
    public enum Kind {
        LODGING(RequestNoteConstraints.LODGING_CONTENT_TYPE, 2),
        /** 카페도 음식점 분류다(`sourceCategory=카페`). */
        RESTAURANT("음식점", 2);

        private final String contentTypeName;
        private final int perZone;

        Kind(String contentTypeName, int perZone) {
            this.contentTypeName = contentTypeName;
            this.perZone = perZone;
        }

        public int perZone() {
            return perZone;
        }

        public boolean matches(PlaceCandidate candidate) {
            return contentTypeName.equals(candidate.contentTypeName());
        }
    }

    /**
     * 제주 전체 일정에서 권역마다 둘 방문 장소(숙박 · 음식점이 아닌 곳)의 하한 (#1312).
     *
     * <p>하루 2~3곳을 고르므로 권역의 날 하루를 그 권역 안에서 채울 수 있는 최소다. 3이면 상한 50 안에서 권역 몫이
     * 방문 18 + 숙박 12 + 음식점 12 = 42곳이고, 남는 8칸이 요청 조건 후보 몫({@code REQUEST_SLOT}=8)과 같다. 4로 올리면 그
     * 8칸이 2칸이 된다.
     *
     * <p><b>요청 조건 후보가 깎이지 않는 것은 조건부다</b> — 상한이 50이고, 일반 검색에 섞여 온 숙박 · 음식점이 권역 몫을
     * 넘지 않을 때다. 숙박 · 음식점은 덜어 내지 않으므로, 일반 검색에 그것이 권역 몫보다 많이 들어 있거나 상한을 50 아래로
     * 두면 칸이 모자란다. 그때는 새로 실을 것을 줄이되 권역을 돌아가며 줄여({@link #acrossZones}) 한 권역만 비지 않게 한다.
     */
    public static final int VISITS_PER_ZONE = 3;

    /**
     * 요청 지역(#1423)으로 풀을 좁히려면 맞닿은 권역까지 남은 방문 장소가 이만큼은 있어야 한다. 2박 3일이 하루 2~3곳이면
     * 6~9곳이라 그보다 적게 남기면 모델이 같은 곳을 되풀이하거나 고를 것이 없다 — 그때는 풀을 그대로 두고, 맞추지 못한
     * 사실은 초안 근거({@code RequestNoteDraftPolicy})가 밝힌다.
     */
    public static final int FOCUS_MIN_VISITS = 6;

    /**
     * 요청 권역마다 채울 방문 장소 수 (#1423). 이미 남은 것도 센다. 3일 일정을 한 권역에서 날마다 2~3곳 고를 수 있는 양이다 —
     * 제주 전체 풀의 권역 하한({@link #VISITS_PER_ZONE}=3)은 하루치라 한 권역 위주 일정에는 모자란다.
     */
    public static final int FOCUS_VISITS_PER_ZONE = 8;

    /** 요청 권역마다 채울 음식점 수 (#1423). 하루 한 끼 자리를 3일. */
    public static final int FOCUS_RESTAURANTS_PER_ZONE = 3;

    /** 요청 권역마다 채울 숙박 수 (#1423). 숙소 재배치 가드({@code AiPlanRouteGuard})가 비교할 거리가 남게 둘보다 하나 더. */
    public static final int FOCUS_LODGINGS_PER_ZONE = 3;

    private CandidateZonePolicy() {
    }

    /**
     * 요청 지역 위주로 풀을 좁힌다 (#1423). "성산 쪽 위주로" 라고 적어도 제주 전체 풀은 6권역에 고르게 깔려(#1312) 모델이
     * 섬을 돌았다.
     *
     * <ol>
     *   <li>좁히지 않는 요청({@link RequestedRegion#narrows()} 가 아니다)이면 풀 그대로다</li>
     *   <li>맞닿은 권역까지({@link RequestedRegion#reach()}) 안의 후보만 남긴다. 권역을 모르는 후보도 뺀다</li>
     *   <li>남은 방문 장소가 {@link #FOCUS_MIN_VISITS} 곳보다 적으면 <b>풀을 그대로 돌려준다</b> — 모으지 않는다. 고를 것이
     *       없는 일정보다 섬을 도는 일정이 낫고, 못 맞춘 사실은 초안 근거가 밝힌다</li>
     *   <li>{@code extra} 에서 <b>요청 권역({@link RequestedRegion#zones()}, 맞닿은 권역 아님)</b>의 것으로 채운다 — 방문 →
     *       음식점 → 숙박 순, 권역마다 {@link #FOCUS_VISITS_PER_ZONE} · {@link #FOCUS_RESTAURANTS_PER_ZONE} ·
     *       {@link #FOCUS_LODGINGS_PER_ZONE} 곳까지(남은 것 포함). 남은 순서를 지키고 더한 것은 뒤에 붙인다. 상한을 넘지
     *       않고, 칸이 모자라면 권역을 돌아가며 줄인다({@link #acrossZones})</li>
     * </ol>
     *
     * @param pool   지금까지 모은 후보(요청 조건 + 일반 검색 + 권역 몫)
     * @param extra  권역 대표점 기준 거리순으로 찾은 후보(#1312). 시군구 지정 요청이면 비어 있다 — 거르기만 한다
     * @param region 요청 지역
     * @param limit  후보 상한({@code ai-llm.place-candidate-size})
     */
    public static List<PlaceCandidate> focus(
        List<PlaceCandidate> pool, List<PlaceCandidate> extra, RequestedRegion region, int limit
    ) {
        List<PlaceCandidate> base = pool == null ? List.of() : pool;
        if (region == null || !region.narrows() || limit <= 0) {
            return base;
        }
        Set<JejuZone> reach = region.reach();
        List<PlaceCandidate> kept = base.stream()
            .filter(candidate -> reach.contains(zoneOf(candidate)))
            .toList();
        if (visitsWithin(kept, reach) < FOCUS_MIN_VISITS) {
            return base;
        }

        Map<JejuZone, int[]> held = new EnumMap<>(JejuZone.class);
        region.zones().forEach(zone -> held.put(zone, new int[FocusKind.values().length]));
        Set<Long> present = new HashSet<>();
        for (PlaceCandidate candidate : kept) {
            present.add(candidate.placeId());
            int[] counts = held.get(zoneOf(candidate));
            if (counts != null) {
                counts[FocusKind.of(candidate).ordinal()]++;
            }
        }

        List<PlaceCandidate> focused = new ArrayList<>(kept);
        for (FocusKind kind : FocusKind.values()) {
            List<PlaceCandidate> eligible = new ArrayList<>();
            for (PlaceCandidate candidate : extra == null ? List.<PlaceCandidate>of() : extra) {
                int[] counts = held.get(zoneOf(candidate));
                if (counts == null || FocusKind.of(candidate) != kind || present.contains(candidate.placeId())
                    || counts[kind.ordinal()] >= kind.perZone) {
                    continue;
                }
                counts[kind.ordinal()]++;
                present.add(candidate.placeId());
                eligible.add(candidate);
            }
            int room = Math.max(0, limit - focused.size());
            // 칸이 모자라면 앞에서 자르지 않는다 — extra 는 권역 선언 순서라 뒤 권역부터 빈다
            focused.addAll(eligible.size() <= room ? eligible : acrossZones(eligible, room));
        }
        return List.copyOf(focused);
    }

    /** 풀에서 {@code zones} 안의 방문 장소 수. 권역을 모르는 후보는 세지 않는다. */
    public static int visitsWithin(List<PlaceCandidate> pool, Set<JejuZone> zones) {
        int count = 0;
        for (PlaceCandidate candidate : pool == null ? List.<PlaceCandidate>of() : pool) {
            JejuZone zone = zoneOf(candidate);
            if (zone != null && zones.contains(zone) && isVisit(candidate)) {
                count++;
            }
        }
        return count;
    }

    /** 요청 지역을 채우는 종류. 선언 순서가 채우는 순서다 — 뒤가 잘리면 다른 결과가 대신할 수 없는 방문 장소를 먼저 지킨다. */
    private enum FocusKind {
        VISIT(FOCUS_VISITS_PER_ZONE),
        RESTAURANT(FOCUS_RESTAURANTS_PER_ZONE),
        LODGING(FOCUS_LODGINGS_PER_ZONE);

        private final int perZone;

        FocusKind(int perZone) {
            this.perZone = perZone;
        }

        private static FocusKind of(PlaceCandidate candidate) {
            if (Kind.LODGING.matches(candidate)) {
                return LODGING;
            }
            return Kind.RESTAURANT.matches(candidate) ? RESTAURANT : VISIT;
        }
    }

    /** 방문 장소인가 — 숙박도 음식점도 아니다. */
    public static boolean isVisit(PlaceCandidate candidate) {
        return !isZoned(candidate);
    }

    /**
     * 권역마다 방문 장소가 {@link #VISITS_PER_ZONE} 곳이 되도록 {@code found} 에서 채운다 (#1312). 이미 풀에 있는 방문
     * 장소도 그 권역 몫으로 센다. 넘치는 만큼 꼬리를 빼되, 권역 하한을 지키는 방문 장소와 숙박 · 음식점은 빼지 않는다.
     *
     * <p>일반 후보는 {@code placeId} 순 첫 50곳이라 권역이 쏠린다 — dev 에서 남동부는 2곳뿐이었고, 숙박 · 음식점을 싣는
     * 꼬리 깎기에 그 2곳마저 빠질 수 있었다.
     *
     * @param found 권역마다 대표점에서 가까운 순으로 찾은 방문 장소. 앞의 것부터 권역 몫을 채운다
     */
    public static List<PlaceCandidate> ensureVisits(List<PlaceCandidate> found, List<PlaceCandidate> base, int limit) {
        List<PlaceCandidate> pool = base == null ? List.of() : base;
        if (found == null || found.isEmpty() || limit <= 0) {
            return pool;
        }
        Map<JejuZone, Integer> held = new EnumMap<>(JejuZone.class);
        Set<Long> present = new HashSet<>();
        for (PlaceCandidate candidate : pool) {
            present.add(candidate.placeId());
            JejuZone zone = isVisit(candidate) ? zoneOf(candidate) : null;
            if (zone != null) {
                held.merge(zone, 1, Integer::sum);
            }
        }
        List<PlaceCandidate> added = new ArrayList<>();
        for (PlaceCandidate candidate : found) {
            JejuZone zone = zoneOf(candidate);
            if (!isVisit(candidate) || zone == null || present.contains(candidate.placeId())
                || held.getOrDefault(zone, 0) >= VISITS_PER_ZONE) {
                continue;
            }
            held.merge(zone, 1, Integer::sum);
            present.add(candidate.placeId());
            added.add(candidate);
        }
        return appendWithinLimit(pool, added, limit, VISITS_PER_ZONE);
    }

    /**
     * 권역마다 {@code kind} 가 {@link Kind#perZone} 곳이 되도록 {@code found} 에서 채우고, 상한을 넘는 만큼 꼬리를 뺀다.
     * 권역 방문 하한이 없는 요청(시군구 지정 · 제주 밖 · 하루 재생성)용이다.
     *
     * @param kind  싣는 종류
     * @param found 그 종류의 검색 결과. 앞의 것부터 권역 몫을 채운다
     * @param base  지금까지 모은 후보(요청 조건 + 일반 검색 + 앞서 실은 종류)
     * @param limit 후보 상한({@code ai-llm.place-candidate-size})
     */
    public static List<PlaceCandidate> spread(Kind kind, List<PlaceCandidate> found, List<PlaceCandidate> base, int limit) {
        return spread(kind, found, base, limit, 0);
    }

    /**
     * {@link #spread(Kind, List, List, int)} 와 같되, 꼬리를 덜어 낼 때 권역마다 앞에서부터 {@code visitFloor} 곳의 방문
     * 장소는 빼지 않는다 (#1312). 0 이면 하한이 없다.
     */
    public static List<PlaceCandidate> spread(
        Kind kind, List<PlaceCandidate> found, List<PlaceCandidate> base, int limit, int visitFloor
    ) {
        List<PlaceCandidate> pool = base == null ? List.of() : base;
        if (found == null || found.isEmpty() || limit <= 0) {
            return pool;
        }

        Map<JejuZone, Integer> held = new EnumMap<>(JejuZone.class);
        Set<Long> present = new HashSet<>();
        for (PlaceCandidate candidate : pool) {
            present.add(candidate.placeId());
            JejuZone zone = kind.matches(candidate) ? zoneOf(candidate) : null;
            if (zone != null) {
                held.merge(zone, 1, Integer::sum);
            }
        }

        List<PlaceCandidate> added = new ArrayList<>();
        for (PlaceCandidate candidate : found) {
            JejuZone zone = zoneOf(candidate);
            if (!kind.matches(candidate) || zone == null || present.contains(candidate.placeId())
                || held.getOrDefault(zone, 0) >= kind.perZone()) {
                continue;
            }
            held.merge(zone, 1, Integer::sum);
            present.add(candidate.placeId());
            added.add(candidate);
        }
        return appendWithinLimit(pool, added, limit, visitFloor);
    }

    /**
     * {@code added} 를 뒤에 붙이고 상한을 넘는 만큼 풀의 뒤에서부터 덜어 낸다. 숙박 · 음식점과, 권역마다 앞에서부터
     * {@code visitFloor} 곳의 방문 장소는 덜어 내지 않는다.
     */
    private static List<PlaceCandidate> appendWithinLimit(
        List<PlaceCandidate> pool, List<PlaceCandidate> added, int limit, int visitFloor
    ) {
        if (added.isEmpty()) {
            return pool;
        }
        Set<Long> floorHolders = floorHolders(pool, visitFloor);
        List<PlaceCandidate> kept = new ArrayList<>(pool);
        int overflow = kept.size() + added.size() - limit;
        for (int index = kept.size() - 1; index >= 0 && overflow > 0; index--) {
            PlaceCandidate candidate = kept.get(index);
            if (!isZoned(candidate) && !floorHolders.contains(candidate.placeId())) {
                kept.remove(index);
                overflow--;
            }
        }
        // 덜어 낼 꼬리가 없으면(권역 몫으로만 찼다) 새로 실을 것을 줄인다 — 상한을 넘기지 않는다.
        // 권역 균형 풀(visitFloor > 0)의 added 는 권역 선언 순서라 앞에서 자르면 남동부(마지막)부터 빈다 — 권역을 돌아가며
        // 줄인다 (#1312). 하한이 없는 요청(시군구 지정 등)은 전처럼 앞에서 자른다
        int room = Math.max(0, added.size() - Math.max(0, overflow));
        kept.addAll(room < added.size() && visitFloor > 0 ? acrossZones(added, room) : added.subList(0, room));
        return List.copyOf(kept);
    }

    /** 권역마다 앞에서부터 {@code visitFloor} 곳의 방문 장소 — 권역 하한을 지키는 몫이라 꼬리 깎기에서 뺀다. */
    private static Set<Long> floorHolders(List<PlaceCandidate> pool, int visitFloor) {
        if (visitFloor <= 0) {
            return Set.of();
        }
        Map<JejuZone, Integer> counted = new EnumMap<>(JejuZone.class);
        Set<Long> holders = new HashSet<>();
        for (PlaceCandidate candidate : pool) {
            JejuZone zone = isVisit(candidate) ? zoneOf(candidate) : null;
            if (zone != null && counted.getOrDefault(zone, 0) < visitFloor) {
                counted.merge(zone, 1, Integer::sum);
                holders.add(candidate.placeId());
            }
        }
        return holders;
    }

    /**
     * 풀의 권역 × 종류별 개수를 한 줄로 (#1312) — {@code NORTH_WEST(visit=5,lodging=2,restaurant=2) … unknown=0}.
     * 권역 날이 다른 권역으로 새는지 다음 조사에서 이 한 줄로 본다.
     */
    public static String describe(List<PlaceCandidate> pool) {
        Map<JejuZone, int[]> counts = new EnumMap<>(JejuZone.class);
        Arrays.stream(JejuZone.values()).forEach(zone -> counts.put(zone, new int[3]));
        int unknown = 0;
        for (PlaceCandidate candidate : pool == null ? List.<PlaceCandidate>of() : pool) {
            JejuZone zone = zoneOf(candidate);
            if (zone == null) {
                unknown++;
                continue;
            }
            int slot = Kind.LODGING.matches(candidate) ? 1 : Kind.RESTAURANT.matches(candidate) ? 2 : 0;
            counts.get(zone)[slot]++;
        }
        StringBuilder line = new StringBuilder();
        counts.forEach((zone, count) -> line.append(zone.name())
            .append("(visit=").append(count[0]).append(",lodging=").append(count[1])
            .append(",restaurant=").append(count[2]).append(") "));
        return line.append("unknown=").append(unknown).toString();
    }

    /**
     * 권역을 돌아가며 {@code count} 곳을 고른다 (#1245). 요청 조건 후보(#1170)를 `placeId` 순 앞에서 자르면 한
     * 권역에 몰린다 — dev 의 실내 카페 앞 8곳 중 5곳이 북서부였다. 권역 순서는 {@link JejuZone} 선언 순서이고,
     * 같은 권역 안에서는 들어온 순서를 지킨다. 권역을 모르는 후보는 맨 뒤에 둔다.
     */
    public static List<PlaceCandidate> acrossZones(List<PlaceCandidate> candidates, int count) {
        if (candidates == null || candidates.isEmpty() || count <= 0) {
            return List.of();
        }
        Map<JejuZone, Deque<PlaceCandidate>> byZone = new LinkedHashMap<>();
        Arrays.stream(JejuZone.values()).forEach(zone -> byZone.put(zone, new ArrayDeque<>()));
        Deque<PlaceCandidate> unknown = new ArrayDeque<>();
        for (PlaceCandidate candidate : candidates) {
            JejuZone zone = zoneOf(candidate);
            (zone == null ? unknown : byZone.get(zone)).add(candidate);
        }

        List<PlaceCandidate> picked = new ArrayList<>(count);
        boolean progressed = true;
        while (picked.size() < count && progressed) {
            progressed = false;
            for (Deque<PlaceCandidate> queue : byZone.values()) {
                if (picked.size() < count && !queue.isEmpty()) {
                    picked.add(queue.poll());
                    progressed = true;
                }
            }
        }
        while (picked.size() < count && !unknown.isEmpty()) {
            picked.add(unknown.poll());
        }
        return List.copyOf(picked);
    }

    /** 권역마다 실은 종류인가 — 상한을 맞출 때 덜어 내지 않는다. */
    private static boolean isZoned(PlaceCandidate candidate) {
        return Arrays.stream(Kind.values()).anyMatch(kind -> kind.matches(candidate));
    }

    private static JejuZone zoneOf(PlaceCandidate candidate) {
        return JejuZone.of(candidate.lat(), candidate.lng());
    }
}

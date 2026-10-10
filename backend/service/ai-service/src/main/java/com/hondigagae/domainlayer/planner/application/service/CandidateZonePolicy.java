package com.hondigagae.domainlayer.planner.application.service;

import com.hondigagae.domainlayer.planner.application.model.JejuZone;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.RequestNoteConstraints;
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
     * 방문 18 + 숙박 12 + 음식점 12 = 42곳이고, 남는 8칸이 요청 조건 후보 몫({@code REQUEST_SLOT}=8)과 같다 — 꼬리를 덜어
     * 낼 때 맨 앞의 요청 조건 후보까지 깎이지 않는다. 4로 올리면 그 8칸이 2칸이 되어 요청 조건 후보가 깎일 수 있다.
     */
    public static final int VISITS_PER_ZONE = 3;

    private CandidateZonePolicy() {
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
        // 덜어 낼 꼬리가 없으면(권역 몫으로만 찼다) 새로 실을 것을 줄인다 — 상한을 넘기지 않는다
        int room = Math.max(0, added.size() - Math.max(0, overflow));
        kept.addAll(added.subList(0, room));
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

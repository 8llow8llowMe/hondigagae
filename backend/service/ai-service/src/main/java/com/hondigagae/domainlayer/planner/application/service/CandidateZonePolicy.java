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

    private CandidateZonePolicy() {
    }

    /**
     * 권역마다 {@code kind} 가 {@link Kind#perZone} 곳이 되도록 {@code found} 에서 채우고, 상한을 넘는 만큼 꼬리를 뺀다.
     *
     * @param kind  싣는 종류
     * @param found 그 종류의 검색 결과. 앞의 것부터 권역 몫을 채운다
     * @param base  지금까지 모은 후보(요청 조건 + 일반 검색 + 앞서 실은 종류)
     * @param limit 후보 상한({@code ai-llm.place-candidate-size})
     */
    public static List<PlaceCandidate> spread(Kind kind, List<PlaceCandidate> found, List<PlaceCandidate> base, int limit) {
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
        if (added.isEmpty()) {
            return pool;
        }

        List<PlaceCandidate> kept = new ArrayList<>(pool);
        int overflow = kept.size() + added.size() - limit;
        for (int index = kept.size() - 1; index >= 0 && overflow > 0; index--) {
            if (!isZoned(kept.get(index))) {
                kept.remove(index);
                overflow--;
            }
        }
        // 덜어 낼 꼬리가 없으면(숙박 · 음식점으로만 찼다) 새로 실을 것을 줄인다 — 상한을 넘기지 않는다
        int room = Math.max(0, added.size() - Math.max(0, overflow));
        kept.addAll(added.subList(0, room));
        return List.copyOf(kept);
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

package com.hondigagae.domainlayer.planner.application.service;

import com.hondigagae.domainlayer.planner.application.model.JejuZone;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.RequestNoteConstraints;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 후보 풀에 숙박을 권역마다 고르게 싣는다 (#1236).
 *
 * <p>후보 풀은 지역 검색 상위 N(`placeId` 순)이라 숙박이 우연히 들어온다. dev 의 제주 전체 50곳에는 숙박이 3곳
 * (서귀포 2 · 구좌 1)뿐이었고, 동반 가능 숙박 56곳이 6권역에 다 있는데도 서쪽 일정에 묵을 곳이 풀에 없었다.
 * 그러면 모델도, 숙소를 옮기는 동선 가드도 고를 수 없다 — #1171 재측정에서 25km 넘는 구간 3개가 그래서 남았다.
 *
 * <ul>
 *   <li><b>권역마다 {@value #PER_ZONE} 곳까지.</b> 이미 풀에 있는 숙박(요청 조건 · 일반 검색)도 그 권역 몫으로
 *       센다. 권역은 프롬프트와 같은 {@link JejuZone} 이다 — 둘이 다른 지도를 보면 안 된다</li>
 *   <li><b>상한은 그대로다.</b> 넘치는 만큼 풀의 <b>뒤에서부터 숙박이 아닌 장소</b>를 뺀다. 앞에는 요청 조건
 *       장소가 있고(#1170), 뒤가 일반 검색의 꼬리다 — 프롬프트 길이가 늘지 않는다</li>
 *   <li><b>권역을 모르는 숙박은 싣지 않는다.</b> 좌표가 없거나 제주 밖이면 어느 권역 몫인지 모른다</li>
 * </ul>
 *
 * <p>필수 포함 · 즐겨찾기는 이 다음에 워커가 합친다 — 그 장소는 상한과 무관하게 들어가야 하므로 여기서 세지 않는다.
 */
public final class LodgingZonePolicy {

    /** 권역마다 실을 숙박 수. 6권역이면 많아야 12곳 — 상한 50의 꼬리를 그만큼 덜어 낸다. */
    public static final int PER_ZONE = 2;

    private LodgingZonePolicy() {
    }

    /**
     * 권역마다 숙박이 {@value #PER_ZONE} 곳이 되도록 {@code stays} 에서 채우고, 상한을 넘는 만큼 꼬리를 뺀다.
     *
     * @param stays 숙박 검색 결과. 앞의 것부터 권역 몫을 채운다
     * @param base  지금까지 모은 후보(요청 조건 + 일반 검색)
     * @param limit 후보 상한({@code ai-llm.place-candidate-size})
     */
    public static List<PlaceCandidate> spread(List<PlaceCandidate> stays, List<PlaceCandidate> base, int limit) {
        List<PlaceCandidate> pool = base == null ? List.of() : base;
        if (stays == null || stays.isEmpty() || limit <= 0) {
            return pool;
        }

        Map<JejuZone, Integer> held = new EnumMap<>(JejuZone.class);
        Set<Long> present = new HashSet<>();
        for (PlaceCandidate candidate : pool) {
            present.add(candidate.placeId());
            JejuZone zone = isLodging(candidate) ? zoneOf(candidate) : null;
            if (zone != null) {
                held.merge(zone, 1, Integer::sum);
            }
        }

        List<PlaceCandidate> added = new ArrayList<>();
        for (PlaceCandidate stay : stays) {
            JejuZone zone = zoneOf(stay);
            if (!isLodging(stay) || zone == null || present.contains(stay.placeId())
                || held.getOrDefault(zone, 0) >= PER_ZONE) {
                continue;
            }
            held.merge(zone, 1, Integer::sum);
            present.add(stay.placeId());
            added.add(stay);
        }
        if (added.isEmpty()) {
            return pool;
        }

        List<PlaceCandidate> kept = new ArrayList<>(pool);
        int overflow = kept.size() + added.size() - limit;
        for (int index = kept.size() - 1; index >= 0 && overflow > 0; index--) {
            if (!isLodging(kept.get(index))) {
                kept.remove(index);
                overflow--;
            }
        }
        // 풀이 숙박으로만 차 있어 덜어 낼 꼬리가 없으면 새 숙박을 덜 싣는다
        int room = Math.max(0, added.size() - Math.max(0, overflow));
        kept.addAll(added.subList(0, room));
        return List.copyOf(kept);
    }

    /** 숙박 후보인가. 분류 이름으로 가른다 — 워커의 로그도 같은 판정을 쓴다. */
    public static boolean isLodging(PlaceCandidate candidate) {
        return RequestNoteConstraints.LODGING_CONTENT_TYPE.equals(candidate.contentTypeName());
    }

    private static JejuZone zoneOf(PlaceCandidate candidate) {
        return JejuZone.of(candidate.lat(), candidate.lng());
    }
}

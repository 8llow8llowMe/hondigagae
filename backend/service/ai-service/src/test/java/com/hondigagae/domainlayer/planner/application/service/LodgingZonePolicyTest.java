package com.hondigagae.domainlayer.planner.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 후보 풀의 숙박 권역 할당 (#1236). 싣는 쪽과 <b>빼는 쪽</b>(일반 검색 꼬리 · 상한)을 함께 밟는다 — 싣기만 보면
 * 상한을 넘겨 프롬프트를 키우는 구현도 통과한다.
 *
 * <p>좌표는 #1171 실측 일정과 dev 숙박의 장소다.
 */
class LodgingZonePolicyTest {

    // 남부(서귀포 시내)
    private static final PlaceCandidate SEOGWIPO_PENSION = stay(101L, 33.2480, 126.5650);
    private static final PlaceCandidate DONNAEKO_RESORT = stay(102L, 33.2850, 126.5800);
    private static final PlaceCandidate SEOGWIPO_THIRD = stay(103L, 33.2500, 126.5600);
    // 남서부(중문 · 안덕 · 한경)
    private static final PlaceCandidate JUNGMUN_STAY = stay(201L, 33.2500, 126.4100);
    private static final PlaceCandidate ANDEOK_STAY = stay(202L, 33.2540, 126.3550);
    private static final PlaceCandidate HANGYEONG_STAY = stay(203L, 33.3000, 126.1700);
    // 북동부(구좌)
    private static final PlaceCandidate GUJWA_HOUSE = stay(301L, 33.5260, 126.8630);

    private static final PlaceCandidate CAFE = visit(1L, "음식점");

    @Test
    @DisplayName("권역마다 두 곳까지 채우고, 넘치는 만큼 일반 검색의 꼬리를 뺀다 — 상한은 그대로다")
    void spreadsPerZoneWithinLimit() {
        List<PlaceCandidate> base = List.of(
            CAFE, visit(2L, "관광지"), visit(3L, "관광지"), visit(4L, "관광지"), visit(5L, "관광지"),
            visit(6L, "관광지"), SEOGWIPO_PENSION);
        List<PlaceCandidate> stays = List.of(
            DONNAEKO_RESORT, SEOGWIPO_THIRD, JUNGMUN_STAY, ANDEOK_STAY, HANGYEONG_STAY, GUJWA_HOUSE);

        List<PlaceCandidate> pool = LodgingZonePolicy.spread(stays, base, 8);

        // 남부는 포시즌(이미 있음) + 돈내코 = 2 라 셋째가 빠지고, 남서부는 앞의 둘만
        assertThat(pool).extracting(PlaceCandidate::placeId)
            .containsExactly(1L, 2L, 3L, 101L, 102L, 201L, 202L, 301L);
        assertThat(pool).hasSize(8);
    }

    @Test
    @DisplayName("이미 풀에 있는 숙박은 한 번만 남고 그 권역 몫으로 센다")
    void countsLodgingAlreadyInPool() {
        List<PlaceCandidate> base = List.of(CAFE, SEOGWIPO_PENSION, DONNAEKO_RESORT);

        List<PlaceCandidate> pool = LodgingZonePolicy.spread(
            List.of(SEOGWIPO_PENSION, SEOGWIPO_THIRD, GUJWA_HOUSE), base, 50);

        assertThat(pool).extracting(PlaceCandidate::placeId).containsExactly(1L, 101L, 102L, 301L);
    }

    @Test
    @DisplayName("권역을 모르는 숙박(좌표 없음 · 제주 밖)과 숙박이 아닌 결과는 싣지 않는다")
    void skipsUnknownZoneAndNonLodging() {
        PlaceCandidate noCoordinates = new PlaceCandidate(401L, "좌표없는숙소", "숙박", "제주", "동반 가능",
            null, null, true, null, null, null);
        PlaceCandidate busan = stay(402L, 35.1587, 129.1604);
        PlaceCandidate notLodging = new PlaceCandidate(403L, "카페", "음식점", "제주", "동반 가능",
            null, null, true, "카페", 33.25, 126.41);

        List<PlaceCandidate> pool = LodgingZonePolicy.spread(
            List.of(noCoordinates, busan, notLodging), List.of(CAFE), 50);

        assertThat(pool).extracting(PlaceCandidate::placeId).containsExactly(1L);
    }

    @Test
    @DisplayName("숙박 검색 결과가 없으면 풀을 그대로 돌려준다")
    void keepsPoolWithoutStays() {
        List<PlaceCandidate> base = List.of(CAFE, visit(2L, "관광지"));

        assertThat(LodgingZonePolicy.spread(List.of(), base, 50)).isSameAs(base);
        assertThat(LodgingZonePolicy.spread(null, base, 50)).isSameAs(base);
    }

    @Test
    @DisplayName("상한 안이면 아무것도 빼지 않고 뒤에 붙인다")
    void appendsWithoutTrimmingUnderLimit() {
        List<PlaceCandidate> pool = LodgingZonePolicy.spread(
            List.of(JUNGMUN_STAY), List.of(CAFE, visit(2L, "관광지")), 50);

        assertThat(pool).extracting(PlaceCandidate::placeId).containsExactly(1L, 2L, 201L);
    }

    @Test
    @DisplayName("풀이 숙박으로만 차 있어 덜어 낼 꼬리가 없으면 새 숙박을 덜 싣는다 — 상한을 넘지 않는다")
    void neverExceedsLimit() {
        List<PlaceCandidate> pool = LodgingZonePolicy.spread(
            List.of(JUNGMUN_STAY, ANDEOK_STAY), List.of(SEOGWIPO_PENSION, DONNAEKO_RESORT), 3);

        assertThat(pool).extracting(PlaceCandidate::placeId).containsExactly(101L, 102L, 201L);
    }

    private static PlaceCandidate stay(long id, double lat, double lng) {
        return new PlaceCandidate(id, "숙소" + id, "숙박", "제주", "동반 가능", null, null, true, "펜션", lat, lng);
    }

    private static PlaceCandidate visit(long id, String contentTypeName) {
        return new PlaceCandidate(id, "장소" + id, contentTypeName, "제주", "동반 가능", null, null, false, null,
            33.5, 126.5);
    }
}

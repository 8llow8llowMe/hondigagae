package com.hondigagae.domainlayer.planner.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.service.CandidateZonePolicy.Kind;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 후보 풀의 권역 할당 (#1236 숙박 · #1245 음식점). 싣는 쪽과 <b>빼는 쪽</b>(일반 검색 꼬리 · 상한)을 함께 밟는다 —
 * 싣기만 보면 상한을 넘겨 프롬프트를 키우는 구현도 통과한다.
 *
 * <p>좌표는 #1171 실측 일정과 dev 숙박 · 카페의 장소다.
 */
class CandidateZonePolicyTest {

    // 숙박 — 남부(서귀포 시내)
    private static final PlaceCandidate SEOGWIPO_PENSION = stay(101L, 33.2480, 126.5650);
    private static final PlaceCandidate DONNAEKO_RESORT = stay(102L, 33.2850, 126.5800);
    private static final PlaceCandidate SEOGWIPO_THIRD = stay(103L, 33.2500, 126.5600);
    // 숙박 — 남서부(중문 · 안덕 · 한경)
    private static final PlaceCandidate JUNGMUN_STAY = stay(201L, 33.2500, 126.4100);
    private static final PlaceCandidate ANDEOK_STAY = stay(202L, 33.2540, 126.3550);
    private static final PlaceCandidate HANGYEONG_STAY = stay(203L, 33.3000, 126.1700);
    // 숙박 — 북동부(구좌)
    private static final PlaceCandidate GUJWA_HOUSE = stay(301L, 33.5260, 126.8630);

    // 카페 — dev 실내 카페 앞 8곳의 모양(북서부에 몰림)
    private static final PlaceCandidate DANGDANG = cafe(601L, 33.4600, 126.3100);       // 북서부
    private static final PlaceCandidate BUNKER_HOUSE = cafe(602L, 33.2500, 126.5500);   // 남부
    private static final PlaceCandidate AEWOL_SUNSET = cafe(603L, 33.4700, 126.3300);   // 북서부
    private static final PlaceCandidate BLISSFUL = cafe(604L, 33.4500, 126.3200);       // 북서부
    private static final PlaceCandidate LA_PLAGE = cafe(605L, 33.5000, 126.5300);       // 북부
    private static final PlaceCandidate JUNGMUN_CAFE = cafe(606L, 33.2400, 126.4000);   // 남서부

    private static final PlaceCandidate CAFE = visit(1L, "음식점");

    @Nested
    @DisplayName("숙박 (#1236)")
    class Lodging {

        @Test
        @DisplayName("권역마다 두 곳까지 채우고, 넘치는 만큼 일반 검색의 꼬리를 뺀다 — 상한은 그대로다")
        void spreadsPerZoneWithinLimit() {
            List<PlaceCandidate> base = List.of(
                CAFE, visit(2L, "관광지"), visit(3L, "관광지"), visit(4L, "관광지"), visit(5L, "관광지"),
                visit(6L, "관광지"), SEOGWIPO_PENSION);
            List<PlaceCandidate> stays = List.of(
                DONNAEKO_RESORT, SEOGWIPO_THIRD, JUNGMUN_STAY, ANDEOK_STAY, HANGYEONG_STAY, GUJWA_HOUSE);

            List<PlaceCandidate> pool = CandidateZonePolicy.spread(Kind.LODGING, stays, base, 9);

            // 남부는 포시즌(이미 있음) + 돈내코 = 2 라 셋째가 빠지고, 남서부는 앞의 둘만. 음식점(1)은 빼지 않는다
            assertThat(pool).extracting(PlaceCandidate::placeId)
                .containsExactly(1L, 2L, 3L, 4L, 101L, 102L, 201L, 202L, 301L);
        }

        @Test
        @DisplayName("이미 풀에 있는 숙박은 한 번만 남고 그 권역 몫으로 센다")
        void countsLodgingAlreadyInPool() {
            List<PlaceCandidate> base = List.of(CAFE, SEOGWIPO_PENSION, DONNAEKO_RESORT);

            List<PlaceCandidate> pool = CandidateZonePolicy.spread(
                Kind.LODGING, List.of(SEOGWIPO_PENSION, SEOGWIPO_THIRD, GUJWA_HOUSE), base, 50);

            assertThat(pool).extracting(PlaceCandidate::placeId).containsExactly(1L, 101L, 102L, 301L);
        }

        @Test
        @DisplayName("권역을 모르는 숙박(좌표 없음 · 제주 밖)과 다른 종류의 결과는 싣지 않는다")
        void skipsUnknownZoneAndOtherKinds() {
            PlaceCandidate noCoordinates = new PlaceCandidate(401L, "좌표없는숙소", "숙박", "제주", "동반 가능",
                null, null, true, null, null, null);
            PlaceCandidate busan = stay(402L, 35.1587, 129.1604);

            List<PlaceCandidate> pool = CandidateZonePolicy.spread(
                Kind.LODGING, List.of(noCoordinates, busan, JUNGMUN_CAFE), List.of(CAFE), 50);

            assertThat(pool).extracting(PlaceCandidate::placeId).containsExactly(1L);
        }

        @Test
        @DisplayName("검색 결과가 없으면 풀을 그대로 돌려준다")
        void keepsPoolWithoutResults() {
            List<PlaceCandidate> base = List.of(CAFE, visit(2L, "관광지"));

            assertThat(CandidateZonePolicy.spread(Kind.LODGING, List.of(), base, 50)).isSameAs(base);
            assertThat(CandidateZonePolicy.spread(Kind.LODGING, null, base, 50)).isSameAs(base);
        }

        @Test
        @DisplayName("상한 안이면 아무것도 빼지 않고 뒤에 붙인다")
        void appendsWithoutTrimmingUnderLimit() {
            List<PlaceCandidate> pool = CandidateZonePolicy.spread(
                Kind.LODGING, List.of(JUNGMUN_STAY), List.of(CAFE, visit(2L, "관광지")), 50);

            assertThat(pool).extracting(PlaceCandidate::placeId).containsExactly(1L, 2L, 201L);
        }

        @Test
        @DisplayName("덜어 낼 꼬리가 없으면 새 숙박을 덜 싣는다 — 상한을 넘지 않는다")
        void neverExceedsLimit() {
            List<PlaceCandidate> pool = CandidateZonePolicy.spread(
                Kind.LODGING, List.of(JUNGMUN_STAY, ANDEOK_STAY), List.of(SEOGWIPO_PENSION, DONNAEKO_RESORT), 3);

            assertThat(pool).extracting(PlaceCandidate::placeId).containsExactly(101L, 102L, 201L);
        }
    }

    @Nested
    @DisplayName("음식점 (#1245)")
    class Restaurant {

        @Test
        @DisplayName("음식점도 권역마다 두 곳까지 싣고, 상한을 맞출 때 앞서 실은 숙박은 덜어 내지 않는다")
        void spreadsRestaurantsWithoutEvictingLodging() {
            List<PlaceCandidate> base = List.of(
                visit(2L, "관광지"), visit(3L, "관광지"), visit(4L, "관광지"), JUNGMUN_STAY, SEOGWIPO_PENSION);

            List<PlaceCandidate> pool = CandidateZonePolicy.spread(
                Kind.RESTAURANT, List.of(DANGDANG, AEWOL_SUNSET, BLISSFUL, JUNGMUN_CAFE), base, 6);

            // 북서부는 둘(당당 · 애월더선셋)까지, 남서부 하나. 셋을 싣느라 관광지 꼬리 둘을 빼고, 숙박은 남는다
            assertThat(pool).extracting(PlaceCandidate::placeId)
                .containsExactly(2L, 201L, 101L, 601L, 603L, 606L);
        }

        @Test
        @DisplayName("요청 조건으로 이미 앞에 있는 카페는 그 권역 몫으로 센다")
        void countsRequestedCafes() {
            List<PlaceCandidate> base = List.of(DANGDANG, AEWOL_SUNSET, visit(2L, "관광지"));

            List<PlaceCandidate> pool = CandidateZonePolicy.spread(
                Kind.RESTAURANT, List.of(BLISSFUL, JUNGMUN_CAFE), base, 50);

            assertThat(pool).extracting(PlaceCandidate::placeId).containsExactly(601L, 603L, 2L, 606L);
        }
    }

    @Nested
    @DisplayName("권역을 돌아가며 고르기 (#1245)")
    class AcrossZones {

        @Test
        @DisplayName("placeId 순으로 한 권역에 몰린 결과를 권역마다 돌아가며 고른다")
        void roundRobinsZones() {
            List<PlaceCandidate> found = List.of(DANGDANG, BUNKER_HOUSE, AEWOL_SUNSET, BLISSFUL, LA_PLAGE, JUNGMUN_CAFE);

            List<PlaceCandidate> picked = CandidateZonePolicy.acrossZones(found, 4);

            // 권역 선언 순서: 북서부 · 북부 · 북동부 · 남서부 · 남부 · 남동부 — 한 바퀴에 권역마다 하나
            assertThat(picked).extracting(PlaceCandidate::placeId).containsExactly(601L, 605L, 606L, 602L);
        }

        @Test
        @DisplayName("한 바퀴로 모자라면 다음 바퀴에서 같은 권역의 다음 것을 고른다 — 권역 안 순서는 지킨다")
        void continuesInNextRound() {
            List<PlaceCandidate> picked = CandidateZonePolicy.acrossZones(
                List.of(DANGDANG, AEWOL_SUNSET, BLISSFUL, LA_PLAGE), 3);

            assertThat(picked).extracting(PlaceCandidate::placeId).containsExactly(601L, 605L, 603L);
        }

        @Test
        @DisplayName("권역을 모르는 후보는 맨 뒤에서 채운다 · 비면 빈 목록이다")
        void unknownZoneLast() {
            PlaceCandidate busanCafe = cafe(699L, 35.1587, 129.1604);

            assertThat(CandidateZonePolicy.acrossZones(List.of(busanCafe, DANGDANG), 2))
                .extracting(PlaceCandidate::placeId).containsExactly(601L, 699L);
            assertThat(CandidateZonePolicy.acrossZones(List.of(), 8)).isEmpty();
            assertThat(CandidateZonePolicy.acrossZones(null, 8)).isEmpty();
        }
    }

    private static PlaceCandidate stay(long id, double lat, double lng) {
        return new PlaceCandidate(id, "숙소" + id, "숙박", "제주", "동반 가능", null, null, true, "펜션", lat, lng);
    }

    private static PlaceCandidate cafe(long id, double lat, double lng) {
        return new PlaceCandidate(id, "카페" + id, "음식점", "제주", "동반 가능", null, null, true, "카페", lat, lng);
    }

    private static PlaceCandidate visit(long id, String contentTypeName) {
        return new PlaceCandidate(id, "장소" + id, contentTypeName, "제주", "동반 가능", null, null, false, null,
            33.5, 126.5);
    }
}

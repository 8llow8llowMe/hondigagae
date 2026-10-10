package com.hondigagae.domainlayer.planner.application.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * 제주 6권역 (#1171). 좌표는 이슈 실측 일정과 dev 후보 풀에 실제로 있던 장소다 — 경계 상수가 지명과 어긋나면
 * 프롬프트의 "하루는 한 권역" 이 엉뚱한 곳을 묶는다.
 */
class JejuZoneTest {

    @ParameterizedTest(name = "{0} → {3}")
    @CsvSource({
        "수월봉(한경), 33.2955, 126.1631, SOUTH_WEST",
        "중문색달해수욕장, 33.2436, 126.4125, SOUTH_WEST",
        "정방폭포(서귀포 시내), 33.2448, 126.5715, SOUTH",
        "곽지해수욕장(애월), 33.4505, 126.3053, NORTH_WEST",
        "용두암(제주 시내), 33.5163, 126.5119, NORTH",
        "용눈이오름(구좌), 33.4592, 126.8317, NORTH_EAST",
        "녹산로 유채꽃도로(표선), 33.3523, 126.7470, SOUTH_EAST",
    })
    @DisplayName("실측 장소의 좌표가 지명에 맞는 권역으로 간다")
    void mapsKnownPlaces(String place, double lat, double lng, JejuZone expected) {
        assertThat(JejuZone.of(lat, lng)).isEqualTo(expected);
    }

    @Test
    @DisplayName("좌표가 없거나 제주 밖이면 권역을 지어 붙이지 않는다")
    void unknownOutsideJeju() {
        assertThat(JejuZone.of(null, 126.5)).isNull();
        assertThat(JejuZone.of(33.5, null)).isNull();
        assertThat(JejuZone.of(35.1587, 129.1604)).isNull();
        // 추자도는 본섬 권역 어디에도 속하지 않는다
        assertThat(JejuZone.of(33.95, 126.30)).isNull();
    }

    @Test
    @DisplayName("같은 줄의 옆 칸과 서쪽 · 동쪽 해안의 위아래만 맞닿는다 — 북부-남부는 한라산 너머다")
    void adjacency() {
        assertThat(JejuZone.NORTH_WEST.adjacentTo(JejuZone.NORTH_WEST)).isTrue();
        assertThat(JejuZone.NORTH_WEST.adjacentTo(JejuZone.NORTH)).isTrue();
        assertThat(JejuZone.NORTH_WEST.adjacentTo(JejuZone.SOUTH_WEST)).isTrue();
        assertThat(JejuZone.SOUTH_EAST.adjacentTo(JejuZone.NORTH_EAST)).isTrue();
        assertThat(JejuZone.SOUTH.adjacentTo(JejuZone.SOUTH_EAST)).isTrue();

        assertThat(JejuZone.NORTH.adjacentTo(JejuZone.SOUTH)).isFalse();
        assertThat(JejuZone.NORTH_WEST.adjacentTo(JejuZone.NORTH_EAST)).isFalse();
        assertThat(JejuZone.SOUTH_WEST.adjacentTo(JejuZone.NORTH_EAST)).isFalse();
        assertThat(JejuZone.NORTH.adjacentTo(null)).isFalse();
    }

    @Test
    @DisplayName("맞닿음은 양방향이다")
    void adjacencyIsSymmetric() {
        for (JejuZone left : JejuZone.values()) {
            for (JejuZone right : JejuZone.values()) {
                assertThat(left.adjacentTo(right)).as("%s-%s", left, right).isEqualTo(right.adjacentTo(left));
            }
        }
    }

    @Test
    @DisplayName("일자별 순서는 서쪽 해안을 내려가 동쪽 해안을 올라오고, 여섯 날을 넘으면 다시 돈다 (#1257)")
    void aroundTheIsland() {
        assertThat(JejuZone.aroundTheIsland(3))
            .containsExactly(JejuZone.NORTH_WEST, JejuZone.SOUTH_WEST, JejuZone.SOUTH);
        assertThat(JejuZone.aroundTheIsland(7)).containsExactly(
            JejuZone.NORTH_WEST, JejuZone.SOUTH_WEST, JejuZone.SOUTH, JejuZone.SOUTH_EAST,
            JejuZone.NORTH_EAST, JejuZone.NORTH, JejuZone.NORTH_WEST);
        assertThat(JejuZone.aroundTheIsland(0)).isEmpty();
    }

    @Test
    @DisplayName("권역마다 대표점이 제 권역 안에 있다 — 거리순 후보 조회의 기준점이다 (#1312)")
    void anchorsLieInTheirOwnZone() {
        for (JejuZone zone : JejuZone.values()) {
            assertThat(JejuZone.of(zone.getAnchorLat(), zone.getAnchorLng())).as("%s 대표점", zone).isEqualTo(zone);
        }
    }

    @Test
    @DisplayName("이웃한 날의 권역은 언제나 맞닿는다 — 한라산을 넘는 북부-남부가 없다")
    void consecutiveDaysAreAdjacent() {
        List<JejuZone> order = JejuZone.aroundTheIsland(13);
        for (int day = 1; day < order.size(); day++) {
            assertThat(order.get(day - 1).adjacentTo(order.get(day)))
                .as("%d일차 %s → %d일차 %s", day, order.get(day - 1), day + 1, order.get(day)).isTrue();
        }
    }
}

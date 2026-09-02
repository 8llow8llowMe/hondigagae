package com.hondigagae.domainlayer.insight.domain.enums;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.common.geo.KmaGrid;
import com.hondigagae.common.geo.KmaGridPoint;
import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 권역 대표 좌표 검증.
 *
 * <p><b>두 권역이 같은 격자에 떨어지면 비교표가 같은 날씨를 두 줄로 보여 준다.</b> 오류가 나지
 * 않고 그럴듯해 보이는 형태라 눈으로는 잡히지 않는다. 좌표를 손볼 때 여기서 먼저 깨지게 한다.
 */
class JejuRegionTest {

    @Test
    @DisplayName("권역 대표 좌표는 서로 다른 기상청 격자에 떨어진다")
    void everyRegionMapsToItsOwnGrid() {
        Map<KmaGridPoint, JejuRegion> byGrid = Arrays.stream(JejuRegion.values())
            .collect(Collectors.toMap(
                region -> KmaGrid.of(region.getLat(), region.getLng()),
                Function.identity(),
                (left, right) -> {
                    throw new AssertionError(
                        "%s 와 %s 의 대표 격자가 같습니다".formatted(left.name(), right.name()));
                }));

        assertThat(byGrid).hasSize(JejuRegion.values().length);
    }

    @Test
    @DisplayName("대표 좌표가 제주 범위 안에 있다")
    void representativeCoordinatesStayInJeju() {
        // 좌표를 잘못 넣으면 격자는 멀쩡히 나오고 엉뚱한 지역 날씨를 제주 권역이라고 보여 준다.
        for (JejuRegion region : JejuRegion.values()) {
            assertThat(region.getLat()).as(region.name() + " 위도").isBetween(33.1d, 33.6d);
            assertThat(region.getLng()).as(region.name() + " 경도").isBetween(126.1d, 127.0d);
        }
    }

    @Test
    @DisplayName("서귀포권만 남부 중기예보 구역을 쓴다")
    void mapsSouthToSeogwipoForecastZone() {
        // 중기예보 기온 지점이 제주/서귀포로 갈린다. 한라산 남쪽만 서귀포다.
        assertThat(JejuRegion.SOUTH.midTermRegion()).isEqualTo(MidTermRegion.SEOGWIPO_SI);
        assertThat(JejuRegion.NORTH.midTermRegion()).isEqualTo(MidTermRegion.JEJU_SI);
        assertThat(JejuRegion.HALLA.midTermRegion()).isEqualTo(MidTermRegion.JEJU_SI);
    }
}

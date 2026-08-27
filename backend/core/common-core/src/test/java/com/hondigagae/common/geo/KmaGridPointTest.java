package com.hondigagae.common.geo;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 격자 묶기 검증.
 *
 * <p>확인하려는 것은 좌표 변환의 정확도가 아니라 <b>같은 블록의 좌표가 반드시 같은 값을 낸다</b>는
 * 성질이다. 이것이 깨지면 캐시 키가 조회 격자와 갈라져 적중률이 조용히 0 에 가까워진다.
 */
class KmaGridPointTest {

    @Test
    @DisplayName("factor 1 이면 격자를 그대로 둔다")
    void keepsGridWhenFactorIsOne() {
        KmaGridPoint grid = new KmaGridPoint(53, 38);

        assertThat(grid.coarsenedBy(1)).isEqualTo(grid);
    }

    @Test
    @DisplayName("factor 가 1 미만이면 설정 오류로 보지 않고 묶지 않는다")
    void keepsGridWhenFactorIsNotPositive() {
        KmaGridPoint grid = new KmaGridPoint(53, 38);

        assertThat(grid.coarsenedBy(0)).isEqualTo(grid);
        assertThat(grid.coarsenedBy(-2)).isEqualTo(grid);
    }

    @Test
    @DisplayName("같은 블록의 격자는 모두 같은 대표 격자로 접힌다")
    void foldsSameBlockToSameGrid() {
        // factor 2 의 블록 (52,38) 에 속하는 네 격자
        KmaGridPoint expected = new KmaGridPoint(52, 38);

        assertThat(new KmaGridPoint(52, 38).coarsenedBy(2)).isEqualTo(expected);
        assertThat(new KmaGridPoint(53, 38).coarsenedBy(2)).isEqualTo(expected);
        assertThat(new KmaGridPoint(52, 39).coarsenedBy(2)).isEqualTo(expected);
        assertThat(new KmaGridPoint(53, 39).coarsenedBy(2)).isEqualTo(expected);
    }

    @Test
    @DisplayName("다른 블록의 격자는 섞이지 않는다")
    void keepsDifferentBlocksApart() {
        // 제주시(53,38)와 성산일출봉(60,37)은 factor 2 로 묶어도 분리되어야 한다.
        assertThat(new KmaGridPoint(53, 38).coarsenedBy(2))
            .isNotEqualTo(new KmaGridPoint(60, 37).coarsenedBy(2));
    }

    @Test
    @DisplayName("음수 좌표에서도 블록이 어긋나지 않는다")
    void foldsNegativeCoordinatesConsistently() {
        // 제주에는 없는 값이지만, 나눗셈이 0 쪽으로 잘리면 -1 과 0 이 같은 블록이 되어
        // 블록 경계가 원점에서만 어긋난다. floorDiv 라 그런 일이 없다.
        assertThat(new KmaGridPoint(-1, -1).coarsenedBy(2)).isEqualTo(new KmaGridPoint(-2, -2));
        assertThat(new KmaGridPoint(-2, -2).coarsenedBy(2)).isEqualTo(new KmaGridPoint(-2, -2));
        assertThat(new KmaGridPoint(0, 0).coarsenedBy(2)).isEqualTo(new KmaGridPoint(0, 0));
    }

    @Test
    @DisplayName("cacheKey 는 접힌 격자를 반영한다")
    void cacheKeyReflectsCoarsenedGrid() {
        assertThat(new KmaGridPoint(53, 39).coarsenedBy(2).cacheKey()).isEqualTo("52:38");
    }
}

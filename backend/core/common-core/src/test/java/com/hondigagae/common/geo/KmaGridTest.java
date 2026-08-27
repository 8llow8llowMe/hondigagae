package com.hondigagae.common.geo;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 격자 변환은 상수 하나만 틀려도 조용히 엉뚱한 지역 날씨를 내려주고, 값이 그럴듯해서
 * 눈으로는 잡히지 않는다. 기상청 문서에 공표된 기준점으로 고정한다.
 */
class KmaGridTest {

    @Test
    @DisplayName("제주시청 좌표는 기상청 문서의 제주 격자(53, 38)로 변환된다")
    void convertsJejuCityHall() {
        KmaGridPoint point = KmaGrid.of(33.4996213d, 126.5311884d);

        assertThat(point.nx()).isEqualTo(53);
        assertThat(point.ny()).isEqualTo(38);
    }

    @Test
    @DisplayName("서울시청 좌표는 기상청 예제의 서울 격자(60, 127)로 변환된다")
    void convertsSeoulCityHall() {
        KmaGridPoint point = KmaGrid.of(37.5666d, 126.9784d);

        assertThat(point.nx()).isEqualTo(60);
        assertThat(point.ny()).isEqualTo(127);
    }

    @Test
    @DisplayName("제주 동쪽 끝 성산일출봉은 제주시와 다른 격자에 떨어진다")
    void separatesEasternJeju() {
        KmaGridPoint jeju = KmaGrid.of(33.4996213d, 126.5311884d);
        KmaGridPoint seongsan = KmaGrid.of(33.4580d, 126.9427d);

        // 제주 전역을 격자 하나로 볼 수 없다는 근거. 고정 격자(53,38)만 쓰면
        // 성산의 날씨가 제주시 날씨로 바뀐다.
        assertThat(seongsan).isNotEqualTo(jeju);
        assertThat(seongsan.nx()).isEqualTo(60);
        assertThat(seongsan.ny()).isEqualTo(37);
    }

    @Test
    @DisplayName("캐시 키는 nx:ny 형태다")
    void buildsCacheKey() {
        assertThat(KmaGrid.of(33.4996213d, 126.5311884d).cacheKey()).isEqualTo("53:38");
    }
}

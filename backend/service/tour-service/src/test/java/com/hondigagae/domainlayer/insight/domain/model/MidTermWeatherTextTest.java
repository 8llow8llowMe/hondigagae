package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 중기예보는 코드가 아니라 사람이 읽는 문장으로 온다. 하늘상태와 강수형태가 한 문장에 섞여
 * 있어 둘을 따로 뽑아내야 하고, 여기서 틀리면 비 오는 날이 맑은 날로 판정된다.
 */
class MidTermWeatherTextTest {

    @Test
    @DisplayName("하늘상태만 적힌 문장을 읽는다")
    void readsSkyOnlyText() {
        assertThat(MidTermWeatherText.toSkyState("맑음")).isEqualTo(SkyState.CLEAR);
        assertThat(MidTermWeatherText.toSkyState("구름많음")).isEqualTo(SkyState.MOSTLY_CLOUDY);
        assertThat(MidTermWeatherText.toSkyState("흐림")).isEqualTo(SkyState.OVERCAST);

        assertThat(MidTermWeatherText.toPrecipitationType("맑음")).isEqualTo(PrecipitationType.NONE);
        assertThat(MidTermWeatherText.toPrecipitationType("흐림")).isEqualTo(PrecipitationType.NONE);
    }

    @Test
    @DisplayName("하늘상태와 강수가 섞인 문장에서 둘을 따로 뽑는다")
    void splitsCombinedText() {
        assertThat(MidTermWeatherText.toSkyState("흐리고 비")).isEqualTo(SkyState.OVERCAST);
        assertThat(MidTermWeatherText.toPrecipitationType("흐리고 비")).isEqualTo(PrecipitationType.RAIN);

        // "구름많고 비" 를 흐림으로 읽으면 안 된다 — 구름많음이 맞다.
        assertThat(MidTermWeatherText.toSkyState("구름많고 비")).isEqualTo(SkyState.MOSTLY_CLOUDY);
        assertThat(MidTermWeatherText.toPrecipitationType("구름많고 비")).isEqualTo(PrecipitationType.RAIN);
    }

    @Test
    @DisplayName("비와 눈이 함께 있으면 눈 정보를 잃지 않는다")
    void keepsSnowWhenMixed() {
        // "비" 를 먼저 잡아 RAIN 으로 끝내면 눈이 사라진다.
        assertThat(MidTermWeatherText.toPrecipitationType("흐리고 비/눈")).isEqualTo(PrecipitationType.RAIN_SNOW);
        assertThat(MidTermWeatherText.toPrecipitationType("구름많고 눈")).isEqualTo(PrecipitationType.SNOW);
    }

    @Test
    @DisplayName("소나기를 비와 구분한다")
    void distinguishesShower() {
        assertThat(MidTermWeatherText.toPrecipitationType("구름많고 소나기")).isEqualTo(PrecipitationType.SHOWER);
    }

    @Test
    @DisplayName("공백 표기 차이를 흡수한다")
    void toleratesSpacing() {
        assertThat(MidTermWeatherText.toSkyState("구름 많고 비")).isEqualTo(SkyState.MOSTLY_CLOUDY);
        assertThat(MidTermWeatherText.toPrecipitationType("구름 많고 비")).isEqualTo(PrecipitationType.RAIN);
    }

    @Test
    @DisplayName("비만 적힌 문장은 흐린 하늘로 본다 - 비가 오는데 맑을 수는 없다")
    void infersOvercastFromPrecipitationOnly() {
        assertThat(MidTermWeatherText.toSkyState("비")).isEqualTo(SkyState.OVERCAST);
    }

    @Test
    @DisplayName("못 알아본 문장은 UNKNOWN 이다 - 좋은 쪽으로 추측하지 않는다")
    void doesNotGuessOnUnknownText() {
        // 임의로 "맑음"으로 채우면 비 오는 날을 좋은 날로 판정하게 된다.
        assertThat(MidTermWeatherText.toSkyState("알 수 없는 표기")).isEqualTo(SkyState.UNKNOWN);
        assertThat(MidTermWeatherText.toPrecipitationType("알 수 없는 표기")).isEqualTo(PrecipitationType.UNKNOWN);
        assertThat(MidTermWeatherText.toSkyState(null)).isEqualTo(SkyState.UNKNOWN);
        assertThat(MidTermWeatherText.toPrecipitationType("")).isEqualTo(PrecipitationType.UNKNOWN);
    }
}

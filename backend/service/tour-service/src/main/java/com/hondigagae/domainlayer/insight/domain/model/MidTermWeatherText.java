package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;

/**
 * 중기예보 날씨 문장 해석.
 *
 * <p><b>단기예보와 형태가 다르다.</b> 단기예보는 숫자 코드(SKY=1/3/4, PTY=0~4)로 오지만
 * 중기예보는 {@code "맑음"}, {@code "구름많음"}, {@code "흐리고 비"} 처럼 사람이 읽는 문장으로
 * 온다. 하늘상태와 강수형태가 <b>한 문장에 섞여</b> 있어 둘을 따로 뽑아내야 한다.
 *
 * <p>부분 문자열 포함으로 판정한다. 원천이 표기를 조금 바꾸거나 못 보던 조합이 오더라도
 * (예: {@code "구름많고 한때 비"}) 최소한 "비"는 잡히게 하기 위해서다. 정확한 표기 집합을
 * 열거해 완전일치로 매칭하면 원천이 한 글자만 바꿔도 전 행이 UNKNOWN 이 된다.
 *
 * <p>못 알아본 문장은 {@link SkyState#UNKNOWN} / {@link PrecipitationType#UNKNOWN} 이다.
 * 임의로 "맑음"으로 채우지 않는다 - 모르는 것을 좋은 쪽으로 추측하면 비 오는 날을 좋은 날로
 * 판정하게 된다.
 */
public final class MidTermWeatherText {

    private MidTermWeatherText() {
    }

    /**
     * 하늘상태를 뽑는다. 흐림 > 구름많음 > 맑음 순으로 먼저 본다 -
     * {@code "구름많고 비"} 는 구름많음이고, {@code "흐리고 비"} 는 흐림이다.
     */
    public static SkyState toSkyState(String weatherText) {
        if (weatherText == null || weatherText.isBlank()) {
            return SkyState.UNKNOWN;
        }
        String text = normalize(weatherText);
        if (text.contains("흐림") || text.contains("흐리")) {
            return SkyState.OVERCAST;
        }
        if (text.contains("구름많")) {
            return SkyState.MOSTLY_CLOUDY;
        }
        if (text.contains("맑음") || text.contains("맑")) {
            return SkyState.CLEAR;
        }
        // 강수만 적힌 문장(예: "비")은 흐린 하늘로 본다. 비가 오는데 맑을 수는 없다.
        if (containsPrecipitation(text)) {
            return SkyState.OVERCAST;
        }
        return SkyState.UNKNOWN;
    }

    /**
     * 강수형태를 뽑는다. 섞인 표기를 먼저 봐야 한다 -
     * {@code "비/눈"} 을 "비" 로 먼저 잡으면 눈 정보가 사라진다.
     */
    public static PrecipitationType toPrecipitationType(String weatherText) {
        if (weatherText == null || weatherText.isBlank()) {
            return PrecipitationType.UNKNOWN;
        }
        String text = normalize(weatherText);

        boolean hasRain = text.contains("비");
        boolean hasSnow = text.contains("눈");
        if (hasRain && hasSnow) {
            return PrecipitationType.RAIN_SNOW;
        }
        if (text.contains("소나기")) {
            return PrecipitationType.SHOWER;
        }
        if (hasSnow) {
            return PrecipitationType.SNOW;
        }
        if (hasRain) {
            return PrecipitationType.RAIN;
        }
        // 하늘상태만 적힌 문장이면 강수는 없는 것이 맞다.
        if (text.contains("맑") || text.contains("구름") || text.contains("흐리") || text.contains("흐림")) {
            return PrecipitationType.NONE;
        }
        return PrecipitationType.UNKNOWN;
    }

    private static boolean containsPrecipitation(String text) {
        return text.contains("비") || text.contains("눈") || text.contains("소나기");
    }

    /** 공백을 지운다. {@code "구름 많고 비"} 와 {@code "구름많고 비"} 를 같게 보기 위해서다. */
    private static String normalize(String weatherText) {
        return weatherText.replace(" ", "");
    }
}

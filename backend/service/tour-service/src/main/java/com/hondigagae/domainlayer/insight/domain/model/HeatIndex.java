package com.hondigagae.domainlayer.insight.domain.model;

/**
 * 기온과 습도를 합친 열지수(체감 더위).
 *
 * <p>반려견은 땀을 흘리지 않고 <b>헐떡임(panting)으로 체온을 내린다.</b> 그 방식은 습도가
 * 높으면 잘 듣지 않는다. 그래서 같은 30도라도 습도 50%와 85%는 다른 날씨다 - 기온만 보는
 * 판정으로는 이 차이가 보이지 않는다. 제주는 해양성 기후라 여름 습도가 높아 특히 그렇다.
 *
 * <p>계산은 Rothfusz 회귀식의 섭씨 계수판이다. 상대적으로 낮은 기온에서는 보정 없이 기온에
 * 수렴하므로, 임계 미만이면 기온을 그대로 쓴다.
 */
public record HeatIndex(double celsius) {

    /** 이 기온 미만에서는 열지수 보정이 의미가 없다. */
    private static final double APPLICABLE_TEMPERATURE = 26.0d;

    private static final double C1 = -8.78469475556d;
    private static final double C2 = 1.61139411d;
    private static final double C3 = 2.33854883889d;
    private static final double C4 = -0.14611605d;
    private static final double C5 = -0.012308094d;
    private static final double C6 = -0.0164248277778d;
    private static final double C7 = 0.002211732d;
    private static final double C8 = 0.00072546d;
    private static final double C9 = -0.000003582d;

    /**
     * @param humidityPercent 상대습도(%). null 이면 보정하지 않고 기온을 그대로 쓴다 -
     *                        없는 값을 평균으로 채우면 없는 근거를 지어내는 것이 된다
     */
    public static HeatIndex of(double temperatureCelsius, Integer humidityPercent) {
        if (humidityPercent == null || temperatureCelsius < APPLICABLE_TEMPERATURE) {
            return new HeatIndex(temperatureCelsius);
        }
        double temperature = temperatureCelsius;
        double humidity = humidityPercent;

        double index = C1
            + C2 * temperature
            + C3 * humidity
            + C4 * temperature * humidity
            + C5 * temperature * temperature
            + C6 * humidity * humidity
            + C7 * temperature * temperature * humidity
            + C8 * temperature * humidity * humidity
            + C9 * temperature * temperature * humidity * humidity;

        // 회귀식이 기온보다 낮은 값을 내는 구간이 있다. 체감이 실제보다 시원할 수는 없다.
        return new HeatIndex(Math.max(index, temperatureCelsius));
    }

    /** 습도 보정이 실제로 적용됐는지. 근거 문장을 만들 때 구분한다. */
    public boolean isAdjusted(double airTemperature) {
        return celsius > airTemperature + 0.5d;
    }
}

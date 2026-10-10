package com.hondigagae.domainlayer.insight.domain.model;

/**
 * 기상청 여름철 체감온도.
 *
 * <p><b>기상청이 예보로 주는 값이 아니라 기상청 공식 산식으로 우리가 계산한다.</b>
 * 단기예보에는 체감온도 카테고리가 없고(기온·습도·풍속만 옴), 기상청은 5~9월 체감온도를
 * 기온과 상대습도로 구한 <b>습구온도(Stull, 2011 근사식)</b> 기반 산식으로 산출한다.
 * 이 클래스는 그 산식을 그대로 옮긴 것이라 기상청 앱·폭염특보 기준(주의보 33℃, 경보 35℃)과
 * 같은 척도의 값이 나온다.
 *
 * <p>이전에 쓰던 NOAA 열지수({@link HeatIndex})는 고온다습에서 이 값보다 4~13℃ 높게 나와
 * 기상청 발표와 어긋났다. 판정·표시의 기준은 이 값으로 통일하고, 열지수는 참고로 병기한다.
 *
 * <p>산식 (기상청 여름철 체감온도):
 * <pre>
 * Tw = Ta·atan(0.151977·√(RH+8.313659)) + atan(Ta+RH) − atan(RH−1.67633)
 *      + 0.00391838·RH^1.5·atan(0.023101·RH) − 4.686035          (Stull 습구온도 근사)
 * 체감온도 = −0.2442 + 0.55399·Tw + 0.45535·Ta − 0.0022·Tw² + 0.00278·Tw·Ta + 3.0
 * </pre>
 */
public record FeelsLikeTemperature(double celsius) {

    /**
     * @param humidityPercent 상대습도(%). null 이면 보정하지 않고 기온을 그대로 쓴다 -
     *                        없는 값을 평균으로 채우면 없는 근거를 지어내는 것이 된다
     */
    public static FeelsLikeTemperature of(double temperatureCelsius, Integer humidityPercent) {
        if (humidityPercent == null) {
            return new FeelsLikeTemperature(temperatureCelsius);
        }
        double ta = temperatureCelsius;
        double rh = humidityPercent;

        double tw = ta * Math.atan(0.151977d * Math.sqrt(rh + 8.313659d))
            + Math.atan(ta + rh)
            - Math.atan(rh - 1.67633d)
            + 0.00391838d * Math.pow(rh, 1.5d) * Math.atan(0.023101d * rh)
            - 4.686035d;

        double feelsLike = -0.2442d + 0.55399d * tw + 0.45535d * ta
            - 0.0022d * tw * tw + 0.00278d * tw * ta + 3.0d;

        return new FeelsLikeTemperature(feelsLike);
    }

    /** 습도 보정이 실제로 적용됐는지(체감이 기온보다 확연히 높은지). 근거 문장을 만들 때 구분한다. */
    public boolean isAdjusted(double airTemperature) {
        return celsius > airTemperature + 0.5d;
    }
}

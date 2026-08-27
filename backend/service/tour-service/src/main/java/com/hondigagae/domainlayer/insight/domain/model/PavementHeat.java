package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.SkyState;

/**
 * 노면(아스팔트) 표면온도 추정.
 *
 * <p><b>이 기능이 반려견 서비스인 이유가 여기에 있다.</b> 사람은 신발을 신고 얼굴 높이의
 * 공기를 마시지만, 반려견은 맨발로 지면을 딛고 지면 가까이서 숨을 쉰다. 기온 25도 맑은
 * 한낮의 아스팔트는 50도를 넘어 발바닥 화상 구간에 들어간다 - 사람 기준으로는 산책하기 좋은
 * 날이다. 기온만 보는 판정은 이 격차를 통째로 놓친다.
 *
 * <p>기상청은 노면온도를 주지 않는다. 그래서 기온에 <b>일사로 인한 상승분</b>을 더해 추정한다.
 * 상승분은 하늘상태(구름이 햇볕을 얼마나 가리는지)와 시간대(태양 고도)로 정한다.
 *
 * <p><b>이것은 추정치다.</b> 실측이 아니므로 응답 문구는 단정형을 피하고 "위험 구간"으로
 * 안내한다. 포장 재질, 색, 그늘 여부에 따라 실제 값은 더 달라진다.
 */
public record PavementHeat(double estimatedCelsius, double airTemperature, double solarGain) {

    /**
     * 맑은 한낮에 아스팔트가 기온보다 더 오르는 폭(섭씨).
     *
     * <p>기온 25도 맑음에서 약 52도라는 널리 인용되는 수치에 맞춘 값이다.
     */
    private static final double MAX_SOLAR_GAIN = 27.0d;

    public static PavementHeat estimate(double airTemperature, SkyState skyState, boolean wet, int hourOfDay) {
        double gain = MAX_SOLAR_GAIN * skyFactor(skyState, wet) * daylightFactor(hourOfDay);
        return new PavementHeat(airTemperature + gain, airTemperature, gain);
    }

    /** 구름이 햇볕을 얼마나 가리는지. 젖은 노면은 증발로 온도가 크게 오르지 않는다. */
    private static double skyFactor(SkyState skyState, boolean wet) {
        if (wet) {
            return 0.1d;
        }
        if (skyState == null) {
            return 0.6d;
        }
        return switch (skyState) {
            case CLEAR -> 1.0d;
            case MOSTLY_CLOUDY -> 0.6d;
            case OVERCAST -> 0.3d;
            // 하늘상태를 모를 때는 중간값을 쓴다. 0 으로 두면 위험을 과소평가한다.
            case UNKNOWN -> 0.6d;
        };
    }

    /**
     * 태양 고도에 따른 가중. 밤에는 지면이 식으므로 0 이다.
     *
     * <p>정오 부근이 가장 높지만 <b>지면은 기온보다 늦게 달아오른다.</b> 실제로 노면이 가장
     * 뜨거운 시간은 14시 전후라 오후 쪽에 무게를 더 둔다.
     */
    private static double daylightFactor(int hourOfDay) {
        return switch (hourOfDay) {
            case 12, 13, 14, 15 -> 1.0d;
            case 11, 16 -> 0.85d;
            case 10, 17 -> 0.6d;
            case 9, 18 -> 0.35d;
            case 7, 8, 19 -> 0.15d;
            default -> 0.0d;
        };
    }
}

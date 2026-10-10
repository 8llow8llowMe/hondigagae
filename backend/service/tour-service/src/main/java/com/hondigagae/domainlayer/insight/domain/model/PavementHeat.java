package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import java.time.LocalDateTime;

/**
 * 노면(아스팔트) 표면온도 추정.
 *
 * <p><b>이 기능이 반려견 서비스인 이유가 여기에 있다.</b> 사람은 신발을 신고 얼굴 높이의
 * 공기를 마시지만, 반려견은 맨발로 지면을 딛고 지면 가까이서 숨을 쉰다. 한여름 기온 25도
 * 맑은 한낮의 아스팔트는 50도를 넘어 발바닥 화상 구간에 들어간다 - 사람 기준으로는 산책하기
 * 좋은 날이다. 기온만 보는 판정은 이 격차를 통째로 놓친다.
 *
 * <p>기상청은 노면온도를 주지 않는다. 그래서 기온에 <b>일사로 인한 상승분</b>을 더해 추정한다.
 *
 * <pre>
 * 노면온도 = 기온 + 27도 x 일사계수(날짜·시각·위도) x 하늘상태계수 x 바람계수
 * </pre>
 *
 * <h2>상승분은 기온이 아니라 일사가 만든다</h2>
 *
 * 더하는 값은 <b>기온 대비 초과분</b>이므로 그 크기를 정하는 것은 그 순간 지면에 꽂히는
 * 햇볕의 양, 즉 <b>태양 고도</b>다. 그래서 시각만 보지 않고 <b>날짜와 위도</b>를 함께 넣어
 * 태양 고도를 실제로 계산한다.
 *
 * <p><b>이전 구현은 시각만 보는 고정표였다.</b> 12~15시를 모두 최대(1.0)로 두었기 때문에
 * 한여름 정오에 맞춘 +27도가 9월 15시에도, 12월 13시에도 그대로 붙었다 - 겨울 정오의 태양은
 * 여름의 절반도 안 되는 고도인데 같은 값을 더한 셈이다. 실제로 기온 29도인 9월 오후에
 * 56도가 나와 사용자가 값을 의심했다.
 *
 * <h2>지면은 기온보다 늦게 달아오른다</h2>
 *
 * 표면에도 열용량이 있어 일사 최대와 노면 최대 사이에 지연이 있다({@link #THERMAL_LAG_HOURS}).
 * 다만 그 지연은 <b>한 시간 남짓</b>이다 - 흔히 말하는 "노면은 14시가 가장 뜨겁다"의 대부분은
 * 지연이 아니라 <b>기온 자체가 14~15시에 최고</b>이기 때문이고, 그 몫은 여기서 더할 것이
 * 아니라 이미 기온에 들어 있다. 둘을 다 넣으면 같은 지연을 두 번 세게 된다.
 *
 * <p>한국 표준시 자오선(동경 135도)과 실제 경도 차이에서 오는 남중 시각 오차(제주 기준 약
 * 34분)는 무시한다. 시간당 계수 차이보다 작아 등급을 바꾸지 않는다.
 *
 * <p><b>이것은 추정치다.</b> 실측이 아니므로 응답 문구는 단정형을 피하고 "위험 구간"으로
 * 안내한다. 포장 재질, 색, 그늘 여부에 따라 실제 값은 더 달라진다.
 */
public record PavementHeat(double estimatedCelsius, double airTemperature, double solarGain) {

    /**
     * 일사가 가장 강할 때 아스팔트가 기온보다 더 오르는 폭(섭씨).
     *
     * <p>"한여름 맑은 한낮, 기온 25도에서 아스팔트 약 52도"라는 널리 인용되는 수치에 맞춘
     * 값이다. <b>기준점이 한여름 정오라는 것이 중요하다</b> - 다른 계절/시각은 아래
     * 일사계수로 그보다 작아진다.
     */
    private static final double MAX_SOLAR_GAIN = 27.0d;

    /**
     * 기준 일사량. 하지 정오 제주(북위 33.5도)의 태양 고도 사인값이다.
     *
     * <p>그때 태양 고도는 {@code 90 - 33.5 + 23.44 = 79.94도} 이고 사인값이 이것이다.
     * 일사계수는 이 값을 1.0 으로 놓은 비율이라 {@link #MAX_SOLAR_GAIN} 의 기준점과 맞물린다.
     */
    private static final double REFERENCE_ALTITUDE_SINE = 0.9846d;

    /** 표면 열용량 때문에 일사 최대보다 노면 최대가 늦는 폭(시간). */
    private static final double THERMAL_LAG_HOURS = 1.0d;

    /** 지축 기울기(도). 태양 적위가 연중 오르내리는 진폭이다. */
    private static final double AXIAL_TILT_DEGREES = 23.44d;

    /** 적위가 0 이 되는 날(춘분 무렵)의 연중 일수. 적위 근사식의 기준점이다. */
    private static final int EQUINOX_DAY_OF_YEAR = 81;

    private static final double DAYS_IN_YEAR = 365.0d;

    /** 지구는 한 시간에 15도 돈다. 시각을 시간각으로 바꾸는 계수다. */
    private static final double DEGREES_PER_HOUR = 15.0d;

    private static final double SOLAR_NOON_HOUR = 12.0d;

    private static final double MINUTES_PER_HOUR = 60.0d;

    /**
     * 바람 1m/s 마다 상승분에서 깎이는 비율.
     *
     * <p>노면이 뜨거운 것은 지면이 받은 열이 공기로 잘 빠지지 않기 때문이라, 바람이 불면
     * 대류로 식어 기온과의 격차가 줄어든다. 계수는 보수적으로(적게 깎이도록) 잡았다 -
     * 여기서 과하게 깎으면 발바닥 화상 위험을 낮춰 말하게 된다.
     */
    private static final double WIND_COOLING_PER_MPS = 0.03d;

    /** 아무리 세게 불어도 남는 상승분. 강풍이라고 노면이 기온까지 식지는 않는다. */
    private static final double MIN_WIND_FACTOR = 0.6d;

    /**
     * 그 시각 그 좌표의 노면온도를 추정한다.
     *
     * @param airTemperature 기온(섭씨)
     * @param skyState       하늘상태. null 이면 중간값으로 본다
     * @param wet            비/눈으로 노면이 젖어 있는지
     * @param windSpeed      풍속(m/s). <b>모르면 null</b> - 보정하지 않아 추정이 더 높게 남는다
     * @param at             예보 시각. <b>시각뿐 아니라 날짜도 쓴다</b> (태양 적위)
     * @param latitude       위도(도). 태양 고도 계산에 쓴다
     */
    public static PavementHeat estimate(
        double airTemperature, SkyState skyState, boolean wet, Double windSpeed,
        LocalDateTime at, double latitude
    ) {
        double gain = MAX_SOLAR_GAIN
            * insolationFactor(at, latitude)
            * skyFactor(skyState, wet)
            * windFactor(windSpeed);
        return new PavementHeat(airTemperature + gain, airTemperature, gain);
    }

    /**
     * 그 날짜 그 시각의 태양 고도로 낸 일사 비율. 0(밤) ~ 1(한여름 한낮).
     *
     * <p>태양 고도의 사인값이 곧 단위 면적당 받는 일사량에 비례한다. 해가 지평선 아래면
     * 음수가 나오므로 0 으로 끊는다 - 밤에는 지면이 달아오르지 않는다.
     */
    private static double insolationFactor(LocalDateTime at, double latitude) {
        double declination = declinationRadians(at.getDayOfYear());
        double hourAngle = hourAngleRadians(at);
        double lat = Math.toRadians(latitude);

        double altitudeSine = Math.sin(lat) * Math.sin(declination)
            + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);

        return clamp(altitudeSine / REFERENCE_ALTITUDE_SINE);
    }

    /** 태양 적위(라디안). 연중 한 번 오르내리는 사인파로 근사한다. */
    private static double declinationRadians(int dayOfYear) {
        double phase = 2 * Math.PI * (dayOfYear - EQUINOX_DAY_OF_YEAR) / DAYS_IN_YEAR;
        return Math.toRadians(AXIAL_TILT_DEGREES * Math.sin(phase));
    }

    /**
     * 시간각(라디안). 남중이 0 이고 한 시간마다 15도씩 벌어진다.
     *
     * <p>{@link #THERMAL_LAG_HOURS} 만큼 <b>과거로 되돌린 시각</b>을 쓴다. 지금 노면 온도를
     * 만든 것은 지금의 햇볕이 아니라 조금 전의 햇볕이기 때문이다.
     */
    private static double hourAngleRadians(LocalDateTime at) {
        double hour = at.getHour() + at.getMinute() / MINUTES_PER_HOUR - THERMAL_LAG_HOURS;
        return Math.toRadians(DEGREES_PER_HOUR * (hour - SOLAR_NOON_HOUR));
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
     * 바람이 노면을 식히는 정도.
     *
     * <p><b>풍속을 모르면 보정하지 않는다.</b> 없는 값을 지어내지 않는다는 규칙이기도 하고,
     * 보정하지 않는 쪽이 추정을 더 높게 남겨 안전한 방향이기도 하다.
     */
    private static double windFactor(Double windSpeed) {
        if (windSpeed == null || windSpeed <= 0.0d) {
            return 1.0d;
        }
        return Math.max(MIN_WIND_FACTOR, 1.0d - WIND_COOLING_PER_MPS * windSpeed);
    }

    private static double clamp(double value) {
        return Math.max(0.0d, Math.min(1.0d, value));
    }
}

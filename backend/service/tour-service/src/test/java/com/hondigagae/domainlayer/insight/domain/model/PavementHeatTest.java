package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 노면(아스팔트) 온도 추정.
 *
 * <p>여기서 고정하는 것은 <b>상승분이 무엇에 따라 달라지는가</b>다. 값 자체는 추정이라
 * 소수점을 지킬 이유가 없지만, "겨울이 여름보다 낮다" "바람이 불면 덜 뜨겁다" 같은 성질이
 * 깨지면 판정이 조용히 틀린다.
 *
 * <p><b>이 테스트가 생긴 이유.</b> 이전 구현은 시각만 보는 고정표라 12~15시가 모두 최대였고,
 * 한여름 정오에 맞춘 +27도가 9월 오후에도 그대로 붙었다. 기온 29도인 날 화면에 56도가 찍혀
 * 값이 잘못됐다는 신고가 들어왔다.
 */
class PavementHeatTest {

    /** 제주시 시내. 이 서비스가 다루는 위도다. */
    private static final double JEJU_LATITUDE = 33.4996d;

    private static final LocalDate SUMMER_SOLSTICE = LocalDate.of(2026, 6, 21);
    private static final LocalDate WINTER_SOLSTICE = LocalDate.of(2026, 12, 21);
    private static final LocalDate EARLY_SEPTEMBER = LocalDate.of(2026, 9, 6);

    @Nested
    @DisplayName("기준점")
    class Calibration {

        @Test
        @DisplayName("한여름 맑은 한낮 기온 25도는 아스팔트 약 52도 - 이 수치에 상수를 맞췄다")
        void matchesTheWidelyCitedFigure() {
            // 이 서비스가 존재하는 이유가 되는 숫자다. 사람에게는 산책하기 좋은 날인데
            // 발바닥에는 화상 구간이다.
            PavementHeat heat = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.CLEAR, null);

            assertThat(heat.estimatedCelsius()).isCloseTo(52.0d, within(0.5d));
            assertThat(heat.airTemperature()).isEqualTo(25.0d);
        }

        @Test
        @DisplayName("상승분은 기온에 더해질 뿐 기온을 대체하지 않는다")
        void keepsAirTemperatureAsTheBase() {
            PavementHeat cool = estimate(SUMMER_SOLSTICE, 13, 20.0d, SkyState.CLEAR, null);
            PavementHeat warm = estimate(SUMMER_SOLSTICE, 13, 30.0d, SkyState.CLEAR, null);

            assertThat(warm.estimatedCelsius() - cool.estimatedCelsius()).isCloseTo(10.0d, within(0.01d));
            assertThat(warm.solarGain()).isCloseTo(cool.solarGain(), within(0.01d));
        }
    }

    @Nested
    @DisplayName("계절")
    class Season {

        @Test
        @DisplayName("같은 시각 같은 기온도 겨울 노면은 여름보다 훨씬 낮다")
        void winterSunIsMuchWeaker() {
            // 이것이 이번 수정의 핵심이다. 시각만 보던 옛 계산은 겨울 정오에도 한여름과
            // 같은 상승분을 더했다 - 태양 고도가 절반도 안 되는데 같은 값을 얹은 셈이다.
            PavementHeat summer = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.CLEAR, null);
            PavementHeat winter = estimate(WINTER_SOLSTICE, 13, 25.0d, SkyState.CLEAR, null);

            assertThat(winter.solarGain()).isLessThan(summer.solarGain() * 0.7d);
        }

        @Test
        @DisplayName("9월 오후는 한여름 한낮만큼 뜨겁지 않다 - 56도 신고의 원인이었다")
        void doesNotTreatSeptemberAfternoonAsMidsummerNoon() {
            // 실제 신고 조건: 기온 29도, 맑음, 15시. 옛 계산은 +27도를 그대로 얹어 56도였다.
            PavementHeat heat = estimate(EARLY_SEPTEMBER, 15, 29.0d, SkyState.CLEAR, 5.0d);

            assertThat(heat.estimatedCelsius()).isLessThan(50.0d);
            // 그렇다고 기온과 같아지지도 않는다. 맨발에는 여전히 뜨겁다.
            assertThat(heat.estimatedCelsius()).isGreaterThan(40.0d);
        }
    }

    @Nested
    @DisplayName("시각")
    class TimeOfDay {

        @Test
        @DisplayName("상승분의 정점은 남중보다 한 시간 늦다 - 표면에도 열용량이 있다")
        void peaksAfterSolarNoon() {
            double noon = estimate(SUMMER_SOLSTICE, 12, 25.0d, SkyState.CLEAR, null).solarGain();
            double peak = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.CLEAR, null).solarGain();
            double later = estimate(SUMMER_SOLSTICE, 14, 25.0d, SkyState.CLEAR, null).solarGain();

            assertThat(peak).isGreaterThan(noon).isGreaterThan(later);
        }

        @Test
        @DisplayName("해가 지면 상승분이 없다 - 밤 노면은 기온 그대로다")
        void noGainAfterSunset() {
            PavementHeat night = estimate(SUMMER_SOLSTICE, 23, 25.0d, SkyState.CLEAR, null);

            assertThat(night.solarGain()).isZero();
            assertThat(night.estimatedCelsius()).isEqualTo(25.0d);
        }

        @Test
        @DisplayName("오후는 오전의 같은 각도와 같은 상승분이다 - 지연은 한 번만 센다")
        void isSymmetricAroundTheLaggedNoon() {
            // 흔히 말하는 "노면은 14시가 가장 뜨겁다"의 대부분은 기온 자체가 그때 최고이기
            // 때문이고, 그 몫은 이미 기온에 들어 있다. 여기서 또 밀면 두 번 세게 된다.
            double before = estimate(SUMMER_SOLSTICE, 11, 25.0d, SkyState.CLEAR, null).solarGain();
            double after = estimate(SUMMER_SOLSTICE, 15, 25.0d, SkyState.CLEAR, null).solarGain();

            assertThat(before).isCloseTo(after, within(0.01d));
        }
    }

    @Nested
    @DisplayName("하늘상태와 바람")
    class SkyAndWind {

        @Test
        @DisplayName("구름이 가릴수록 덜 달아오른다")
        void cloudsReduceGain() {
            double clear = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.CLEAR, null).solarGain();
            double cloudy = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.MOSTLY_CLOUDY, null).solarGain();
            double overcast = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.OVERCAST, null).solarGain();

            assertThat(clear).isGreaterThan(cloudy);
            assertThat(cloudy).isGreaterThan(overcast);
        }

        @Test
        @DisplayName("하늘상태를 모르면 중간값을 쓴다 - 0 으로 두면 위험을 과소평가한다")
        void unknownSkyFallsBackToMiddle() {
            double unknown = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.UNKNOWN, null).solarGain();
            double overcast = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.OVERCAST, null).solarGain();
            double clear = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.CLEAR, null).solarGain();

            assertThat(unknown).isGreaterThan(overcast).isLessThan(clear);
        }

        @Test
        @DisplayName("젖은 노면은 증발로 거의 달아오르지 않는다")
        void wetPavementBarelyHeatsUp() {
            PavementHeat wet = PavementHeat.estimate(
                25.0d, SkyState.CLEAR, true, null, SUMMER_SOLSTICE.atTime(13, 0), JEJU_LATITUDE);

            assertThat(wet.estimatedCelsius()).isLessThan(30.0d);
        }

        @Test
        @DisplayName("바람이 세면 대류로 식어 상승분이 줄어든다")
        void windCoolsThePavement() {
            double calm = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.CLEAR, 0.0d).solarGain();
            double breezy = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.CLEAR, 9.0d).solarGain();

            assertThat(breezy).isLessThan(calm);
        }

        @Test
        @DisplayName("아무리 세게 불어도 기온까지 식지는 않는다")
        void windCoolingHasAFloor() {
            double gale = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.CLEAR, 40.0d).solarGain();
            double calm = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.CLEAR, 0.0d).solarGain();

            assertThat(gale).isGreaterThanOrEqualTo(calm * 0.6d);
        }

        @Test
        @DisplayName("풍속을 모르면 보정하지 않는다 - 추정이 더 높게 남는 쪽이 안전하다")
        void doesNotInventWindSpeed() {
            double unknown = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.CLEAR, null).solarGain();
            double calm = estimate(SUMMER_SOLSTICE, 13, 25.0d, SkyState.CLEAR, 0.0d).solarGain();

            assertThat(unknown).isEqualTo(calm);
        }
    }

    // --- fixtures ---

    private static PavementHeat estimate(
        LocalDate date, int hour, double airTemperature, SkyState sky, Double windSpeed
    ) {
        LocalDateTime at = date.atTime(hour, 0);
        return PavementHeat.estimate(airTemperature, sky, false, windSpeed, at, JEJU_LATITUDE);
    }
}

package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.domainlayer.insight.domain.enums.WalkSafetyReasonCode;
import com.hondigagae.shared.travel.insight.WalkSafetyLevel;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class WalkSafetyEvaluatorTest {

    private static final LocalDate DATE = LocalDate.of(2026, 8, 27);

    @Nested
    @DisplayName("노면 온도")
    class PavementRules {

        @Test
        @DisplayName("사람 기준으로 좋은 25도 맑은 한낮도 반려견에게는 위험이다")
        void warnsOnMildLookingSunnyAfternoon() {
            // 사람 기준 기온만 보면 아무 문제 없는 날이다. 이 격차가 이 기능의 존재 이유다.
            WalkSafetyAssessment assessment = evaluate(forecast(25.0d, 50, SkyState.CLEAR, 14), 14);

            assertThat(assessment.estimatedPavementCelsius()).isGreaterThanOrEqualTo(50.0d);
            assertThat(assessment.level()).isEqualTo(WalkSafetyLevel.DANGER);
            assertThat(codesOf(assessment)).contains(WalkSafetyReasonCode.PAVEMENT_HEAT);
        }

        @Test
        @DisplayName("같은 기온이라도 해가 진 뒤에는 노면이 식어 안전하다")
        void sameTemperatureIsSafeAfterSunset() {
            WalkSafetyAssessment noon = evaluate(forecast(25.0d, 50, SkyState.CLEAR, 14), 14);
            WalkSafetyAssessment evening = evaluate(forecast(25.0d, 50, SkyState.CLEAR, 21), 21);

            assertThat(evening.estimatedPavementCelsius()).isLessThan(noon.estimatedPavementCelsius());
            assertThat(evening.level()).isEqualTo(WalkSafetyLevel.SAFE);
        }

        @Test
        @DisplayName("흐린 날은 같은 기온에도 노면이 덜 달아오른다")
        void overcastReducesPavementHeat() {
            WalkSafetyAssessment clear = evaluate(forecast(25.0d, 50, SkyState.CLEAR, 14), 14);
            WalkSafetyAssessment overcast = evaluate(forecast(25.0d, 50, SkyState.OVERCAST, 14), 14);

            assertThat(overcast.estimatedPavementCelsius()).isLessThan(clear.estimatedPavementCelsius());
        }
    }

    @Nested
    @DisplayName("열지수")
    class HeatIndexRules {

        @Test
        @DisplayName("같은 기온이라도 습하면 체감이 올라간다 - 반려견은 헐떡임으로 열을 내보낸다")
        void humidityRaisesPerceivedHeat() {
            WalkSafetyAssessment dry = evaluate(forecast(30.0d, 40, SkyState.OVERCAST, 20), 20);
            WalkSafetyAssessment humid = evaluate(forecast(30.0d, 90, SkyState.OVERCAST, 20), 20);

            assertThat(humid.heatIndexCelsius()).isGreaterThan(dry.heatIndexCelsius());
            assertThat(codesOf(humid)).contains(WalkSafetyReasonCode.HEAT_INDEX_HIGH);
        }

        @Test
        @DisplayName("습도를 모르면 보정하지 않는다 - 없는 값을 지어내지 않는다")
        void doesNotInventHumidity() {
            WalkSafetyAssessment assessment = evaluate(forecast(30.0d, null, SkyState.OVERCAST, 20), 20);

            assertThat(assessment.heatIndexCelsius()).isEqualTo(30.0d);
        }
    }

    @Nested
    @DisplayName("반려견 개별 조건")
    class PetRules {

        @Test
        @DisplayName("단두종은 같은 더위에서 더 높은 위험으로 본다")
        void brachycephalicRaisesRisk() {
            WeatherForecast hot = forecast(31.0d, 80, SkyState.OVERCAST, 20);
            WalkSafetyAssessment normal = evaluate(hot, PetCondition.unspecified(), 20);
            WalkSafetyAssessment pug = evaluate(hot, PetCondition.builder().breed("퍼그").build(), 20);

            assertThat(pug.level().getSeverity()).isGreaterThanOrEqualTo(normal.level().getSeverity());
            assertThat(codesOf(pug)).contains(WalkSafetyReasonCode.BRACHYCEPHALIC);
        }

        @Test
        @DisplayName("견종 표기가 달라도 잡아낸다")
        void matchesBreedNameVariants() {
            assertThat(BreedHeatRisk.isBrachycephalic("프렌치 불독")).isTrue();
            assertThat(BreedHeatRisk.isBrachycephalic("French Bulldog")).isTrue();
            assertThat(BreedHeatRisk.isBrachycephalic("시추")).isTrue();
            assertThat(BreedHeatRisk.isBrachycephalic("포메라니안")).isFalse();
            assertThat(BreedHeatRisk.isBrachycephalic(null)).isFalse();
        }
    }

    @Nested
    @DisplayName("안전 시간대 제안")
    class SaferWindowRules {

        @Test
        @DisplayName("위험할 때는 같은 날 더 나은 시간대를 함께 제안한다")
        void suggestsSaferWindowWhenRisky() {
            List<WeatherForecast> hourly = sunnyDayCoolingDown();
            WalkSafetyAssessment assessment = WalkSafetyEvaluator.evaluate(
                hourly.stream().filter(forecast -> forecast.forecastAt().getHour() == 14).findFirst().orElseThrow(),
                hourly, PetCondition.unspecified(), thresholds(), DATE.atTime(14, 0),
                ForecastCoverage.AVAILABLE, null);

            assertThat(assessment.level()).isEqualTo(WalkSafetyLevel.DANGER);
            assertThat(assessment.hasSaferWindow()).isTrue();
            // 이미 지나간 아침을 제안하면 조언이 아니다. 기준 시각 이후만 본다.
            assertThat(assessment.saferWindowStart().getHour()).isGreaterThan(14);
            assertThat(codesOf(assessment)).contains(WalkSafetyReasonCode.SAFE_WINDOW);
        }

        @Test
        @DisplayName("이미 안전하면 시간대를 제안하지 않는다")
        void noWindowWhenAlreadySafe() {
            WalkSafetyAssessment assessment = evaluate(forecast(18.0d, 50, SkyState.OVERCAST, 20), 20);

            assertThat(assessment.level()).isEqualTo(WalkSafetyLevel.SAFE);
            assertThat(assessment.hasSaferWindow()).isFalse();
        }
    }

    @Test
    @DisplayName("예보가 없으면 UNKNOWN 이고, 안전하다고 말하지 않는다")
    void unknownWhenNoForecast() {
        WalkSafetyAssessment assessment = WalkSafetyEvaluator.evaluate(
            null, List.of(), PetCondition.unspecified(), thresholds(), DATE.atTime(14, 0),
            ForecastCoverage.OUT_OF_RANGE, null);

        assertThat(assessment.level()).isEqualTo(WalkSafetyLevel.UNKNOWN);
        assertThat(codesOf(assessment)).contains(WalkSafetyReasonCode.FORECAST_OUT_OF_RANGE);
    }

    @Test
    @DisplayName("예보 시각대가 지난 것과 예보를 못 받은 것을 다른 근거로 말한다")
    void separatesDayEndedFromUnavailable() {
        // 밤 11시에 오늘을 물으면 예보 시각이 없는 것이 정상이다. 그것을 "3일 이후라 판단하지
        // 않았다"고 하면 사용자는 오늘 날짜를 미래로 착각하고, "가져오지 못했다"고 하면
        // 풀리지 않을 것을 계속 다시 시도한다.
        WalkSafetyAssessment dayEnded = WalkSafetyEvaluator.evaluate(
            null, List.of(), PetCondition.unspecified(), thresholds(), DATE.atTime(23, 30),
            ForecastCoverage.DAY_ENDED, null);
        WalkSafetyAssessment unavailable = WalkSafetyEvaluator.evaluate(
            null, List.of(), PetCondition.unspecified(), thresholds(), DATE.atTime(23, 30),
            ForecastCoverage.UNAVAILABLE, null);

        assertThat(codesOf(dayEnded)).containsExactly(WalkSafetyReasonCode.FORECAST_DAY_ENDED);
        assertThat(codesOf(unavailable)).containsExactly(WalkSafetyReasonCode.FORECAST_UNAVAILABLE);
        assertThat(dayEnded.level()).isEqualTo(WalkSafetyLevel.UNKNOWN);
        assertThat(unavailable.level()).isEqualTo(WalkSafetyLevel.UNKNOWN);
    }

    // --- fixtures ---

    private static List<WalkSafetyReasonCode> codesOf(WalkSafetyAssessment assessment) {
        return assessment.reasons().stream().map(WalkSafetyReason::code).toList();
    }

    private static WalkSafetyAssessment evaluate(WeatherForecast forecast, int hour) {
        return evaluate(forecast, PetCondition.unspecified(), hour);
    }

    private static WalkSafetyAssessment evaluate(WeatherForecast forecast, PetCondition pet, int hour) {
        return WalkSafetyEvaluator.evaluate(
            forecast, List.of(forecast), pet, thresholds(), DATE.atTime(hour, 0),
            ForecastCoverage.AVAILABLE, null);
    }

    private static WeatherForecast forecast(double temperature, Integer humidity, SkyState sky, int hour) {
        return WeatherForecast.builder()
            .nx(53).ny(38)
            .forecastAt(DATE.atTime(hour, 0))
            .baseAt(DATE.atTime(2, 0))
            .temperature(temperature)
            .humidity(humidity)
            .skyState(sky)
            .precipitationType(PrecipitationType.NONE)
            .precipitation(PrecipitationAmount.none())
            .precipitationProbability(10)
            .windSpeed(2.0d)
            .build();
    }

    /** 한낮은 뜨겁고 저녁으로 갈수록 식는 맑은 하루. */
    private static List<WeatherForecast> sunnyDayCoolingDown() {
        List<WeatherForecast> hourly = new ArrayList<>();
        for (int hour = 9; hour <= 22; hour++) {
            double temperature = hour <= 15 ? 30.0d : Math.max(20.0d, 30.0d - (hour - 15) * 1.5d);
            hourly.add(forecast(temperature, 55, SkyState.CLEAR, hour));
        }
        return hourly;
    }

    private static SuitabilityThresholds thresholds() {
        return SuitabilityThresholds.builder()
            .rainProbabilityPercent(60)
            .hotTemperature(28.0d).veryHotTemperature(31.0d)
            .coldTemperature(5.0d).veryColdTemperature(0.0d)
            .strongWindSpeed(9.0d)
            .pavementCautionCelsius(42.0d).pavementDangerCelsius(52.0d)
            .heatIndexCautionCelsius(27.0d).heatIndexDangerCelsius(32.0d)
            .build();
    }
}

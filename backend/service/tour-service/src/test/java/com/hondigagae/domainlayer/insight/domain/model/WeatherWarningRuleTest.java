package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.domainlayer.insight.domain.enums.SuitabilityReasonCode;
import com.hondigagae.domainlayer.insight.domain.enums.WalkSafetyReasonCode;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningLevel;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningType;
import com.hondigagae.shared.travel.insight.ForecastSource;
import com.hondigagae.shared.travel.insight.SuitabilityLevel;
import com.hondigagae.shared.travel.insight.WalkSafetyLevel;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 기상특보 판정 규칙 검증.
 *
 * <p>이 테스트가 지키려는 문장은 하나다 — <b>태풍경보에 "여행 적합 82점"이 나가면 안 된다.</b>
 *
 * <p>날씨가 아무리 좋아도 경보가 뜨면 점수가 0 이어야 한다. 감점으로 다루면 다른 조건이 좋을 때
 * 상쇄되어 그럴듯한 점수가 나가는데, 경보는 정도의 문제가 아니라 기상청이 "나가지 말라"고
 * 말하는 단계다.
 */
class WeatherWarningRuleTest {

    private static final LocalDate DATE = LocalDate.of(2026, 9, 2);
    /** 제주시 시내. 노면온도 추정이 태양 고도를 쓰므로 위도가 필요하다. */
    private static final double JEJU_LATITUDE = 33.4996d;

    @Nested
    @DisplayName("적합도")
    class Suitability {

        @Test
        @DisplayName("경보가 뜨면 날씨가 좋아도 0점이다")
        void forcesZeroOnWarningLevel() {
            // 경보가 없으면 높은 점수가 나오는 조건을 일부러 만든다.
            SuitabilityScore without = SuitabilityEvaluator.evaluate(input(null));
            assertThat(without.score()).isGreaterThan(70);

            SuitabilityScore with = SuitabilityEvaluator.evaluate(
                input(warning(WeatherWarningType.TYPHOON, WeatherWarningLevel.WARNING)));

            assertThat(with.score()).isZero();
            assertThat(codesOf(with)).contains(SuitabilityReasonCode.WEATHER_WARNING_ACTIVE);
        }

        @Test
        @DisplayName("경보여도 등급은 INSUFFICIENT 가 아니다 — 모르는 것이 아니라 나쁜 것이다")
        void keepsLevelMeaningful() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(warning(WeatherWarningType.TYPHOON, WeatherWarningLevel.WARNING)));

            // INSUFFICIENT 는 "판단 근거가 없다"는 뜻이다. 지금은 근거가 있고, 나쁘다고 말하고 있다.
            assertThat(score.level()).isNotEqualTo(SuitabilityLevel.INSUFFICIENT);
            assertThat(score.level()).isEqualTo(SuitabilityLevel.LOW);
            assertThat(score.weatherApplied()).isTrue();
        }

        @Test
        @DisplayName("주의보는 큰 감점이되 0점까지 누르지는 않는다")
        void penalisesAdvisoryWithoutZeroing() {
            SuitabilityScore without = SuitabilityEvaluator.evaluate(input(null));
            SuitabilityScore with = SuitabilityEvaluator.evaluate(
                input(warning(WeatherWarningType.STRONG_WIND, WeatherWarningLevel.ADVISORY)));

            assertThat(with.score()).isLessThan(without.score());
            // 아직 판단의 여지가 있는 단계다. 실내 위주 일정이면 다르게 읽힐 수 있다.
            assertThat(with.score()).isPositive();
        }

        @Test
        @DisplayName("특보가 없으면 근거에 특보 항목이 생기지 않는다")
        void addsNoReasonWithoutWarning() {
            assertThat(codesOf(SuitabilityEvaluator.evaluate(input(null))))
                .doesNotContain(SuitabilityReasonCode.WEATHER_WARNING_ACTIVE);
        }
    }

    @Nested
    @DisplayName("산책 위험도")
    class WalkSafety {

        @Test
        @DisplayName("경보가 뜨면 위험이다")
        void dangerOnWarningLevel() {
            WalkSafetyAssessment assessment = assess(
                warning(WeatherWarningType.TYPHOON, WeatherWarningLevel.WARNING));

            assertThat(assessment.level()).isEqualTo(WalkSafetyLevel.DANGER);
            assertThat(assessment.reasons()).extracting(WalkSafetyReason::code)
                .contains(WalkSafetyReasonCode.WEATHER_WARNING_ACTIVE);
        }

        @Test
        @DisplayName("경보면 시각별 예보가 없어도 UNKNOWN 이 아니다")
        void dangerEvenWithoutForecast() {
            // 태풍경보에 "판단 근거 부족"을 돌려주면 안 된다 - 근거는 있고, 나가지 말라고 말한다.
            WalkSafetyAssessment assessment = WalkSafetyEvaluator.evaluate(
                null, List.of(), PetCondition.unspecified(), thresholds(), DATE.atTime(14, 0),
                ForecastCoverage.DAY_ENDED,
                warning(WeatherWarningType.TYPHOON, WeatherWarningLevel.WARNING), JEJU_LATITUDE);

            assertThat(assessment.level()).isEqualTo(WalkSafetyLevel.DANGER);
        }

        @Test
        @DisplayName("주의보는 조건이 좋아도 최소 주의다")
        void atLeastCautionOnAdvisory() {
            // 기상청이 조건이 나빠지고 있다고 알린 상태에서 "안전"을 단언하면 안 된다.
            WalkSafetyAssessment assessment = assess(
                warning(WeatherWarningType.STRONG_WIND, WeatherWarningLevel.ADVISORY));

            assertThat(assessment.level()).isEqualTo(WalkSafetyLevel.CAUTION);
        }

        @Test
        @DisplayName("특보가 없으면 좋은 날은 그대로 안전이다")
        void staysSafeWithoutWarning() {
            assertThat(assess(null).level()).isEqualTo(WalkSafetyLevel.SAFE);
        }

        private WalkSafetyAssessment assess(WeatherWarning warning) {
            WeatherForecast mild = WeatherForecast.builder()
                .forecastAt(DATE.atTime(9, 0))
                .temperature(18.0d).humidity(50).skyState(SkyState.OVERCAST)
                .build();
            return WalkSafetyEvaluator.evaluate(
                mild, List.of(mild), PetCondition.unspecified(), thresholds(), DATE.atTime(9, 0),
                ForecastCoverage.AVAILABLE, warning, JEJU_LATITUDE);
        }
    }

    @Nested
    @DisplayName("여러 특보가 겹칠 때")
    class Heaviest {

        @Test
        @DisplayName("경보가 주의보보다 먼저다")
        void prefersWarningOverAdvisory() {
            List<WeatherWarning> warnings = List.of(
                warning(WeatherWarningType.HEAVY_RAIN, WeatherWarningLevel.ADVISORY),
                warning(WeatherWarningType.STRONG_WIND, WeatherWarningLevel.WARNING));

            assertThat(WeatherWarning.heaviest(warnings)).get()
                .extracting(WeatherWarning::level).isEqualTo(WeatherWarningLevel.WARNING);
        }

        @Test
        @DisplayName("같은 단계면 더 심각한 종류를 고른다")
        void prefersSevererTypeAtSameLevel() {
            List<WeatherWarning> warnings = List.of(
                warning(WeatherWarningType.DRY, WeatherWarningLevel.WARNING),
                warning(WeatherWarningType.TYPHOON, WeatherWarningLevel.WARNING));

            assertThat(WeatherWarning.heaviest(warnings)).get()
                .extracting(WeatherWarning::type).isEqualTo(WeatherWarningType.TYPHOON);
        }

        @Test
        @DisplayName("특보가 없으면 비어 있다")
        void emptyWhenNone() {
            assertThat(WeatherWarning.heaviest(List.of())).isEmpty();
            assertThat(WeatherWarning.heaviest(null)).isEmpty();
        }
    }

    @Nested
    @DisplayName("문구 해석")
    class TextParsing {

        @Test
        @DisplayName("원천 문구에서 종류와 단계를 뽑는다")
        void parsesTypeAndLevel() {
            assertThat(WeatherWarningType.from("호우주의보")).isEqualTo(WeatherWarningType.HEAVY_RAIN);
            assertThat(WeatherWarningLevel.from("호우주의보")).isEqualTo(WeatherWarningLevel.ADVISORY);
            assertThat(WeatherWarningType.from("태풍경보")).isEqualTo(WeatherWarningType.TYPHOON);
            assertThat(WeatherWarningLevel.from("태풍경보")).isEqualTo(WeatherWarningLevel.WARNING);
        }

        @Test
        @DisplayName("못 알아본 문구는 특보 없음이 아니라 기타 특보다")
        void unknownTextStaysAWarning() {
            // 표기가 바뀌었을 뿐인데 특보를 놓치는 것이 이 기능의 최악이다.
            assertThat(WeatherWarningType.from("황사경보")).isEqualTo(WeatherWarningType.OTHER);
            assertThat(WeatherWarningLevel.from("황사경보")).isEqualTo(WeatherWarningLevel.WARNING);
        }
    }

    // --- fixtures ---

    private static WeatherWarning warning(WeatherWarningType type, WeatherWarningLevel level) {
        return WeatherWarning.builder()
            .type(type).level(level).effectiveAt(LocalDateTime.of(2026, 9, 2, 6, 0))
            .sourceText(type.getDisplayName() + level.getDisplayName())
            .build();
    }

    private static List<SuitabilityReasonCode> codesOf(SuitabilityScore score) {
        return score.reasons().stream().map(SuitabilityReason::code).toList();
    }

    private static SuitabilityInput input(WeatherWarning warning) {
        return SuitabilityInput.builder()
            .place(PlaceCondition.builder()
                .placeId(1L).title("천지연폭포")
                .petAllowanceType(PetAllowanceType.ALLOWED)
                .build())
            .pet(PetCondition.unspecified())
            .weather(DailyWeather.builder()
                .date(DATE).source(ForecastSource.SHORT_TERM)
                .minTemperature(18.0d).maxTemperature(23.0d)
                .maxPrecipitationProbability(10)
                .hourly(List.of())
                .build())
            .weatherWarning(warning)
            .thresholds(thresholds())
            .build();
    }

    private static SuitabilityThresholds thresholds() {
        return SuitabilityThresholds.builder()
            .rainProbabilityPercent(60)
            .hotTemperature(28.0d).veryHotTemperature(31.0d)
            .coldTemperature(5.0d).veryColdTemperature(0.0d)
            .strongWindSpeed(9.0d)
            .pavementCautionCelsius(42.0d).pavementDangerCelsius(52.0d)
            .feelsLikeCautionCelsius(33.0d).feelsLikeDangerCelsius(35.0d)
            .build();
    }
}

package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.shared.travel.insight.WalkSafetyLevel;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 골든타임 산출 검증.
 *
 * <p>확인하려는 것 둘이다.
 *
 * <ul>
 *   <li><b>추천할 게 없을 때 추천하지 않는가</b> — 위험뿐인 날에 "그나마 이때"를 주면
 *       사용자는 그것을 허락으로 읽는다</li>
 *   <li><b>고르는 기준이 흔들리지 않는가</b> — 같은 곡선에 같은 답이어야 한다</li>
 * </ul>
 */
class GoldenWalkWindowTest {

    private static final LocalDate DATE = LocalDate.of(2026, 9, 2);
    /** 제주시 시내. 노면온도 추정이 태양 고도를 쓰므로 위도가 필요하다. */
    private static final double JEJU_LATITUDE = 33.4996d;

    @Nested
    @DisplayName("구간 고르기")
    class Picking {

        @Test
        @DisplayName("안전 구간이 주의 구간보다 먼저다")
        void prefersSafeOverCaution() {
            // 주의 구간이 더 길어도 안전이 이긴다.
            List<HourlyWalkSafety> curve = List.of(
                point(9, WalkSafetyLevel.CAUTION), point(10, WalkSafetyLevel.CAUTION),
                point(11, WalkSafetyLevel.CAUTION), point(12, WalkSafetyLevel.DANGER),
                point(18, WalkSafetyLevel.SAFE), point(19, WalkSafetyLevel.SAFE));

            GoldenWalkWindow golden = GoldenWalkWindow.from(curve).orElseThrow();

            assertThat(golden.level()).isEqualTo(WalkSafetyLevel.SAFE);
            assertThat(golden.start().getHour()).isEqualTo(18);
            assertThat(golden.end().getHour()).isEqualTo(19);
        }

        @Test
        @DisplayName("같은 등급이면 긴 구간을 고른다")
        void prefersLongerRunAtSameLevel() {
            // 30분짜리 안전 구간보다 세 시간이 쓸모 있다.
            List<HourlyWalkSafety> curve = List.of(
                point(9, WalkSafetyLevel.SAFE), point(10, WalkSafetyLevel.DANGER),
                point(17, WalkSafetyLevel.SAFE), point(18, WalkSafetyLevel.SAFE),
                point(19, WalkSafetyLevel.SAFE));

            GoldenWalkWindow golden = GoldenWalkWindow.from(curve).orElseThrow();

            assertThat(golden.start().getHour()).isEqualTo(17);
            assertThat(golden.minutes()).isEqualTo(120);
        }

        @Test
        @DisplayName("등급과 길이가 같으면 이른 구간을 고른다 — 답이 흔들리지 않는다")
        void breaksTieByEarlierStart() {
            List<HourlyWalkSafety> curve = List.of(
                point(8, WalkSafetyLevel.SAFE), point(9, WalkSafetyLevel.SAFE),
                point(10, WalkSafetyLevel.DANGER),
                point(18, WalkSafetyLevel.SAFE), point(19, WalkSafetyLevel.SAFE));

            assertThat(GoldenWalkWindow.from(curve).orElseThrow().start().getHour()).isEqualTo(8);
            assertThat(GoldenWalkWindow.from(curve).orElseThrow().start().getHour()).isEqualTo(8);
        }

        @Test
        @DisplayName("안전과 주의가 섞인 구간은 주의로 본다")
        void downgradesMixedRun() {
            // 좋은 쪽으로 접으면 위험을 낮춰 말하게 된다.
            List<HourlyWalkSafety> curve = List.of(
                point(17, WalkSafetyLevel.SAFE), point(18, WalkSafetyLevel.CAUTION),
                point(19, WalkSafetyLevel.SAFE));

            assertThat(GoldenWalkWindow.from(curve).orElseThrow().level())
                .isEqualTo(WalkSafetyLevel.CAUTION);
        }
    }

    @Nested
    @DisplayName("추천하지 않을 때")
    class NoRecommendation {

        @Test
        @DisplayName("남은 시간이 전부 위험이면 비어 있다")
        void emptyWhenAllDangerous() {
            List<HourlyWalkSafety> curve = List.of(
                point(12, WalkSafetyLevel.DANGER), point(13, WalkSafetyLevel.DANGER),
                point(14, WalkSafetyLevel.DANGER));

            assertThat(GoldenWalkWindow.from(curve)).isEmpty();
        }

        @Test
        @DisplayName("판단할 수 없는 시각만 있으면 비어 있다")
        void emptyWhenAllUnknown() {
            assertThat(GoldenWalkWindow.from(List.of(point(12, WalkSafetyLevel.UNKNOWN)))).isEmpty();
        }

        @Test
        @DisplayName("곡선이 비면 비어 있다")
        void emptyWhenCurveIsEmpty() {
            assertThat(GoldenWalkWindow.from(List.of())).isEmpty();
            assertThat(GoldenWalkWindow.from(null)).isEmpty();
        }
    }

    @Nested
    @DisplayName("곡선 산출")
    class Curve {

        @Test
        @DisplayName("기준 시각 이전은 빼고 시각순으로 준다")
        void dropsPastHours() {
            // 이미 지나간 아침을 제안하면 조언이 아니다.
            List<WeatherForecast> hourly = List.of(
                forecast(9, 24.0d), forecast(15, 30.0d), forecast(18, 26.0d));

            List<HourlyWalkSafety> curve = WalkSafetyEvaluator.hourlyCurve(
                hourly, PetCondition.unspecified(), thresholds(), DATE.atTime(13, 0), JEJU_LATITUDE);

            assertThat(curve).extracting(point -> point.at().getHour()).containsExactly(15, 18);
        }

        @Test
        @DisplayName("등급뿐 아니라 근거 수치도 함께 준다")
        void carriesEvidence() {
            // 등급만 주면 화면이 색깔은 그려도 왜 그 색인지 말하지 못한다.
            List<HourlyWalkSafety> curve = WalkSafetyEvaluator.hourlyCurve(
                List.of(forecast(15, 30.0d)), PetCondition.unspecified(), thresholds(), DATE.atTime(13, 0),
                JEJU_LATITUDE);

            assertThat(curve).singleElement().satisfies(point -> {
                assertThat(point.temperature()).isEqualTo(30.0d);
                // 노면은 기온보다 뜨겁다. 이 차이가 이 서비스의 핵심 근거다.
                assertThat(point.estimatedPavementCelsius()).isGreaterThan(point.temperature());
            });
        }
    }

    // --- fixtures ---

    private static HourlyWalkSafety point(int hour, WalkSafetyLevel level) {
        return new HourlyWalkSafety(DATE.atTime(hour, 0), level, 25.0d, 35.0d, 10);
    }

    private static WeatherForecast forecast(int hour, double temperature) {
        return WeatherForecast.builder()
            .forecastAt(DATE.atTime(hour, 0))
            .temperature(temperature)
            .humidity(55)
            .skyState(SkyState.CLEAR)
            .precipitationProbability(10)
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

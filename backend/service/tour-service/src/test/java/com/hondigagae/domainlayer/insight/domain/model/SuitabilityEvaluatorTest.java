package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.domainlayer.insight.domain.enums.SuitabilityReasonCode;
import com.hondigagae.shared.travel.insight.SuitabilityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class SuitabilityEvaluatorTest {

    private static final LocalDate DATE = LocalDate.of(2026, 8, 27);

    @Nested
    @DisplayName("판단 근거가 없을 때")
    class WhenNoEvidence {

        @Test
        @DisplayName("날씨가 없으면 점수를 만들지 않는다 - 0점이 아니라 null 이다")
        void doesNotInventScoreWithoutWeather() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(input(null, true, allowedPlace(), pet()));

            assertThat(score.score()).isNull();
            assertThat(score.level()).isEqualTo(SuitabilityLevel.INSUFFICIENT);
            assertThat(score.weatherApplied()).isFalse();
        }

        @Test
        @DisplayName("예보 범위 밖과 조회 실패를 다른 근거로 구분한다")
        void distinguishesOutOfRangeFromFailure() {
            SuitabilityScore outOfRange = SuitabilityEvaluator.evaluate(input(null, true, allowedPlace(), pet()));
            SuitabilityScore failed = SuitabilityEvaluator.evaluate(input(null, false, allowedPlace(), pet()));

            assertThat(codesOf(outOfRange)).contains(SuitabilityReasonCode.FORECAST_OUT_OF_RANGE);
            assertThat(codesOf(failed)).contains(SuitabilityReasonCode.FORECAST_UNAVAILABLE);
        }

        @Test
        @DisplayName("점수를 못 내도 동반 가능 여부 같은 아는 사실은 근거로 남긴다")
        void keepsKnownFactsEvenWithoutScore() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(input(null, true, allowedPlace(), pet()));

            assertThat(codesOf(score)).contains(SuitabilityReasonCode.PET_ALLOWED);
        }
    }

    @Nested
    @DisplayName("날씨 판정")
    class WeatherRules {

        @Test
        @DisplayName("좋은 날씨에 동반 가능한 장소는 높은 등급이 나온다")
        void scoresHighOnMildDay() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(mildWeather(), false, allowedPlace(), pet()));

            assertThat(score.score()).isNotNull();
            assertThat(score.level()).isEqualTo(SuitabilityLevel.HIGH);
            assertThat(codesOf(score)).contains(SuitabilityReasonCode.WEATHER_OK);
        }

        @Test
        @DisplayName("더위에 민감한 아이는 같은 폭염에 더 크게 깎인다")
        void penalizesHeatSensitivePetMore() {
            SuitabilityScore normal = SuitabilityEvaluator.evaluate(
                input(hotWeather(), false, outdoorPlace(), pet()));
            SuitabilityScore sensitive = SuitabilityEvaluator.evaluate(
                input(hotWeather(), false, outdoorPlace(), heatSensitivePet()));

            assertThat(sensitive.score()).isLessThan(normal.score());
            assertThat(codesOf(sensitive)).contains(SuitabilityReasonCode.HEAT_RISK);
        }

        @Test
        @DisplayName("실내 공간이 있으면 날씨 감점이 줄지만 사라지지는 않는다")
        void indoorShelterHalvesWeatherPenalty() {
            SuitabilityScore outdoor = SuitabilityEvaluator.evaluate(
                input(rainyWeather(), false, outdoorPlace(), pet()));
            SuitabilityScore indoor = SuitabilityEvaluator.evaluate(
                input(rainyWeather(), false, indoorPlace(), pet()));

            assertThat(indoor.score()).isGreaterThan(outdoor.score());
            // 오가는 길은 여전히 밖이라 감점이 0 이 되지는 않는다.
            assertThat(indoor.score()).isLessThan(100);
            assertThat(codesOf(indoor)).contains(SuitabilityReasonCode.INDOOR_SHELTER);
        }

        @Test
        @DisplayName("근거 문장에 실제 수치가 들어간다")
        void reasonsCarryActualNumbers() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(rainyWeather(), false, outdoorPlace(), pet()));

            SuitabilityReason rain = score.reasons().stream()
                .filter(reason -> reason.code() == SuitabilityReasonCode.RAIN_EXPECTED)
                .findFirst()
                .orElseThrow();
            assertThat(rain.description()).contains("80%");
        }
    }

    @Nested
    @DisplayName("반려견 동반 조건")
    class PetAllowanceRules {

        @Test
        @DisplayName("동반 불가 장소는 날씨가 좋아도 크게 깎인다")
        void blockedPlaceLosesHeavily() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(mildWeather(), false, blockedPlace(), pet()));

            assertThat(score.score()).isLessThanOrEqualTo(40);
            assertThat(codesOf(score)).contains(SuitabilityReasonCode.PET_NOT_ALLOWED);
        }

        @Test
        @DisplayName("크기 제한은 반려견 크기를 알 때만 감점한다")
        void sizeRestrictionAppliesOnlyWhenSizeKnown() {
            SuitabilityScore unknownSize = SuitabilityEvaluator.evaluate(
                input(mildWeather(), false, smallOnlyPlace(), pet()));
            SuitabilityScore largeDog = SuitabilityEvaluator.evaluate(
                input(mildWeather(), false, smallOnlyPlace(), largePet()));

            assertThat(largeDog.score()).isLessThan(unknownSize.score());
            assertThat(codesOf(largeDog)).contains(SuitabilityReasonCode.PET_SIZE_RESTRICTED);
        }

        @Test
        @DisplayName("소형견은 소형견만 가능 장소에서 감점되지 않는다")
        void smallDogPassesSmallOnlyPlace() {
            SuitabilityScore withSize = SuitabilityEvaluator.evaluate(
                input(mildWeather(), false, smallOnlyPlace(), smallPet()));
            SuitabilityScore noRestriction = SuitabilityEvaluator.evaluate(
                input(mildWeather(), false, allowedPlace(), smallPet()));

            assertThat(withSize.score()).isEqualTo(noRestriction.score());
        }
    }

    @Nested
    @DisplayName("혼잡도")
    class CongestionRules {

        @Test
        @DisplayName("연결된 혼잡도 데이터가 없으면 근거에서 빼고 그 사실을 남긴다")
        void missingCongestionIsStated() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(mildWeather(), false, allowedPlace(), pet()));

            assertThat(score.congestionApplied()).isFalse();
            assertThat(codesOf(score)).contains(SuitabilityReasonCode.CONGESTION_UNAVAILABLE);
        }

        @Test
        @DisplayName("소음에 민감한 아이는 혼잡한 날 추가로 깎인다")
        void noiseSensitivePetLosesMoreWhenCrowded() {
            SuitabilityInput base = SuitabilityInput.builder()
                .place(allowedPlace()).pet(pet()).weather(mildWeather())
                .congestion(CongestionSnapshot.of(DATE, 85.0)).thresholds(thresholds()).build();
            SuitabilityInput sensitive = SuitabilityInput.builder()
                .place(allowedPlace()).pet(noiseSensitivePet()).weather(mildWeather())
                .congestion(CongestionSnapshot.of(DATE, 85.0)).thresholds(thresholds()).build();

            SuitabilityScore normalScore = SuitabilityEvaluator.evaluate(base);
            SuitabilityScore sensitiveScore = SuitabilityEvaluator.evaluate(sensitive);

            assertThat(normalScore.congestionApplied()).isTrue();
            assertThat(sensitiveScore.score()).isLessThan(normalScore.score());
            assertThat(codesOf(sensitiveScore)).contains(SuitabilityReasonCode.NOISE_SENSITIVE_CROWD);
        }
    }

    @Test
    @DisplayName("근거는 점수 영향이 큰 순서로 정렬된다")
    void reasonsAreSortedByImpact() {
        SuitabilityScore score = SuitabilityEvaluator.evaluate(
            input(hotWeather(), false, blockedPlace(), heatSensitivePet()));

        List<Integer> impacts = score.reasons().stream().map(reason -> Math.abs(reason.scoreDelta())).toList();
        assertThat(impacts).isSortedAccordingTo((left, right) -> Integer.compare(right, left));
    }

    // --- fixtures ---

    private static List<SuitabilityReasonCode> codesOf(SuitabilityScore score) {
        return score.reasons().stream().map(SuitabilityReason::code).toList();
    }

    private static SuitabilityInput input(
        DailyWeather weather, boolean outOfRange, PlaceCondition place, PetCondition pet
    ) {
        return SuitabilityInput.builder()
            .place(place).pet(pet).weather(weather).forecastOutOfRange(outOfRange)
            .congestion(CongestionSnapshot.unknown(DATE)).thresholds(thresholds()).build();
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

    private static PlaceCondition allowedPlace() {
        return PlaceCondition.builder()
            .placeId(1L).title("천지연폭포").lat(33.24).lng(126.55)
            .petAllowanceType(PetAllowanceType.ALLOWED).allowedPetSize(AllowedPetSize.ALL)
            .build();
    }

    private static PlaceCondition outdoorPlace() {
        return PlaceCondition.builder()
            .placeId(1L).title("협재해수욕장").lat(33.39).lng(126.23)
            .petAllowanceType(PetAllowanceType.ALLOWED).allowedPetSize(AllowedPetSize.ALL)
            .indoor(false).outdoor(true)
            .build();
    }

    private static PlaceCondition indoorPlace() {
        return PlaceCondition.builder()
            .placeId(2L).title("제주현대미술관").lat(33.35).lng(126.26)
            .petAllowanceType(PetAllowanceType.ALLOWED).allowedPetSize(AllowedPetSize.ALL)
            .indoor(true).outdoor(false)
            .build();
    }

    private static PlaceCondition blockedPlace() {
        return PlaceCondition.builder()
            .placeId(3L).title("동반 불가 장소").lat(33.3).lng(126.5)
            .petAllowanceType(PetAllowanceType.NOT_ALLOWED).allowedPetSize(AllowedPetSize.UNKNOWN)
            .build();
    }

    private static PlaceCondition smallOnlyPlace() {
        return PlaceCondition.builder()
            .placeId(4L).title("소형견 전용 카페").lat(33.3).lng(126.5)
            .petAllowanceType(PetAllowanceType.ALLOWED).allowedPetSize(AllowedPetSize.SMALL_ONLY)
            .build();
    }

    private static PetCondition pet() {
        return PetCondition.unspecified();
    }

    private static PetCondition heatSensitivePet() {
        return PetCondition.builder().heatSensitive(true).build();
    }

    private static PetCondition noiseSensitivePet() {
        return PetCondition.builder().noiseSensitive(true).build();
    }

    private static PetCondition largePet() {
        return PetCondition.builder().sizeType(PetSizeType.LARGE).build();
    }

    private static PetCondition smallPet() {
        return PetCondition.builder().sizeType(PetSizeType.SMALL).build();
    }

    private static DailyWeather mildWeather() {
        return DailyWeather.builder()
            .date(DATE).minTemperature(18.0d).maxTemperature(24.0d)
            .maxPrecipitationProbability(10).worstPrecipitationType(PrecipitationType.NONE)
            .representativeSkyState(SkyState.CLEAR).maxWindSpeed(3.0d).maxHumidity(55)
            .hourly(List.of())
            .build();
    }

    private static DailyWeather hotWeather() {
        return DailyWeather.builder()
            .date(DATE).minTemperature(26.0d).maxTemperature(33.0d)
            .maxPrecipitationProbability(10).worstPrecipitationType(PrecipitationType.NONE)
            .representativeSkyState(SkyState.CLEAR).maxWindSpeed(3.0d).maxHumidity(80)
            .hourly(List.of())
            .build();
    }

    private static DailyWeather rainyWeather() {
        return DailyWeather.builder()
            .date(DATE).minTemperature(20.0d).maxTemperature(24.0d)
            .maxPrecipitationProbability(80).worstPrecipitationType(PrecipitationType.RAIN)
            .representativeSkyState(SkyState.OVERCAST).maxWindSpeed(4.0d).maxHumidity(90)
            .hourly(List.of())
            .build();
    }
}

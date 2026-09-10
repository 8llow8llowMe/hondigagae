package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.domainlayer.insight.domain.enums.SuitabilityReasonCode;
import com.hondigagae.shared.travel.insight.ForecastSource;
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
    @DisplayName("고온 규칙 — 체감온도")
    class HeatRules {

        @Test
        @DisplayName("같은 기온 30도라도 습한 날은 더 깎인다 - 습도가 점수를 바꾼다 (#407)")
        void humidityChangesTheScoreAtTheSameAirTemperature() {
            SuitabilityScore dry = SuitabilityEvaluator.evaluate(
                input(dryHotWeather(), false, outdoorPlace(), pet()));
            SuitabilityScore humid = SuitabilityEvaluator.evaluate(
                input(humidHotWeather(), false, outdoorPlace(), pet()));

            // 건조한 30도는 체감 28.5도라 기온 규칙(-15), 습한 30도는 체감 33.2도라 매우 더움(-30).
            assertThat(heatReasonOf(dry).scoreDelta()).isEqualTo(-15);
            SuitabilityReason heat = heatReasonOf(humid);
            assertThat(heat.scoreDelta()).isEqualTo(-30);
            assertThat(heat.description()).startsWith("최고 체감온도 33도").contains("기온 30도");
            assertThat(humid.score()).isLessThan(dry.score());
        }

        @Test
        @DisplayName("기온이 임계 아래여도 체감이 넘으면 깎는다 - 기온만 보면 놓치던 날")
        void penalizesWhenOnlyFeelsLikeCrossesTheThreshold() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(humidWarmWeather(), false, outdoorPlace(), pet()));

            // 기온 27도는 임계(28) 아래라 기온만 보면 감점이 0 이다. 체감 30.1도로 -15.
            SuitabilityReason heat = heatReasonOf(score);
            assertThat(heat.description()).startsWith("최고 체감온도 30도").contains("기온 27도");
            assertThat(heat.scoreDelta()).isEqualTo(-15);
        }

        @Test
        @DisplayName("기온과 체감이 모두 임계를 넘어도 감점은 한 번뿐이다 - 같은 더위를 두 번 세지 않는다")
        void countsHeatOnlyOnce() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(veryHotWeather(), false, outdoorPlace(), pet()));

            // 기온 33도·체감 33.5도. 큰 값(체감)으로 한 번만 깎는다.
            List<SuitabilityReason> heats = score.reasons().stream()
                .filter(reason -> reason.code() == SuitabilityReasonCode.HEAT_RISK)
                .toList();
            assertThat(heats).hasSize(1);
            assertThat(heats.getFirst().description()).startsWith("최고 체감온도 34도").contains("기온 33도");
            assertThat(heats.getFirst().scoreDelta()).isEqualTo(-30);
        }

        @Test
        @DisplayName("기온이 비어 있어도 체감만으로 판정한다")
        void judgesWithFeelsLikeAloneWhenAirTemperatureIsMissing() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(feelsLikeOnlyWeather(), false, outdoorPlace(), pet()));

            // 문장에 없는 기온을 지어내지 않는다.
            SuitabilityReason heat = heatReasonOf(score);
            assertThat(heat.description()).startsWith("최고 체감온도 36도").doesNotContain("기온 ");
            assertThat(heat.scoreDelta()).isEqualTo(-30);
        }

        @Test
        @DisplayName("체감이 기온보다 낮은 건조한 날은 기존 기온 규칙 그대로다")
        void keepsAirTemperatureRuleWhenFeelsLikeIsLower() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(dryWarmWeather(), false, outdoorPlace(), pet()));

            SuitabilityReason heat = heatReasonOf(score);
            assertThat(heat.description()).startsWith("최고기온 29도");
            assertThat(heat.scoreDelta()).isEqualTo(-15);
        }

        @Test
        @DisplayName("중기예보는 체감온도가 없어 기온 규칙으로 퇴화한다 - 예외가 아니라 정상 경로다")
        void fallsBackToAirTemperatureOnMidTermForecast() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(midTermHotWeather(), false, outdoorPlace(), pet()));

            SuitabilityReason heat = heatReasonOf(score);
            assertThat(heat.description()).startsWith("최고기온 33도");
            assertThat(heat.scoreDelta()).isEqualTo(-30);
        }

        @Test
        @DisplayName("더위에 약한 아이 가산은 체감 기준으로 깎을 때도 붙는다")
        void sensitiveExtraAlsoAppliesOnFeelsLikePenalty() {
            SuitabilityScore normal = SuitabilityEvaluator.evaluate(
                input(humidHotWeather(), false, outdoorPlace(), pet()));
            SuitabilityScore sensitive = SuitabilityEvaluator.evaluate(
                input(humidHotWeather(), false, outdoorPlace(), heatSensitivePet()));

            SuitabilityReason heat = heatReasonOf(sensitive);
            assertThat(heat.description()).startsWith("최고 체감온도 33도").contains("더위에 약한 아이");
            assertThat(heat.scoreDelta()).isEqualTo(-42);
            assertThat(sensitive.score()).isLessThan(normal.score());
        }

        private SuitabilityReason heatReasonOf(SuitabilityScore score) {
            return score.reasons().stream()
                .filter(reason -> reason.code() == SuitabilityReasonCode.HEAT_RISK)
                .findFirst()
                .orElseThrow();
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

        @Test
        @DisplayName("추가 요금 원문이 \"없음\" 이면 깎지 않고 근거도 만들지 않는다 — 요금이 있습니다 (없음) 이 나가던 자리 (#231)")
        void noFeeWordingIsNotAFee() {
            SuitabilityScore noFee = SuitabilityEvaluator.evaluate(
                input(mildWeather(), false, placeWithExtraFee("없음"), pet()));
            SuitabilityScore blank = SuitabilityEvaluator.evaluate(
                input(mildWeather(), false, allowedPlace(), pet()));

            assertThat(noFee.score()).isEqualTo(blank.score());
            assertThat(codesOf(noFee)).doesNotContain(SuitabilityReasonCode.PET_EXTRA_FEE);
        }

        @Test
        @DisplayName("실제 금액이 적혀 있으면 3점 깎고 원문을 근거에 그대로 싣는다")
        void actualFeeIsPenalizedWithRawText() {
            SuitabilityScore charged = SuitabilityEvaluator.evaluate(
                input(mildWeather(), false, placeWithExtraFee("20,000원"), pet()));
            SuitabilityScore blank = SuitabilityEvaluator.evaluate(
                input(mildWeather(), false, allowedPlace(), pet()));

            assertThat(charged.score()).isEqualTo(blank.score() - 3);
            SuitabilityReason fee = charged.reasons().stream()
                .filter(reason -> reason.code() == SuitabilityReasonCode.PET_EXTRA_FEE)
                .findFirst()
                .orElseThrow();
            assertThat(fee.description()).contains("20,000원").doesNotContain("없음");
            assertThat(fee.scoreDelta()).isEqualTo(-3);
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

        @Test
        @DisplayName("사회성 낮은 아이도 혼잡한 날 추가로 깎인다 - 소리가 아니라 대면이 문제라 소음 민감과 별개 근거다")
        void lowSocialityPetLosesMoreWhenCrowded() {
            SuitabilityInput base = SuitabilityInput.builder()
                .place(allowedPlace()).pet(pet()).weather(mildWeather())
                .congestion(CongestionSnapshot.of(DATE, 85.0)).thresholds(thresholds()).build();
            SuitabilityInput lowSociality = SuitabilityInput.builder()
                .place(allowedPlace()).pet(lowSocialityPet()).weather(mildWeather())
                .congestion(CongestionSnapshot.of(DATE, 85.0)).thresholds(thresholds()).build();

            SuitabilityScore normalScore = SuitabilityEvaluator.evaluate(base);
            SuitabilityScore lowScore = SuitabilityEvaluator.evaluate(lowSociality);

            assertThat(lowScore.score()).isLessThan(normalScore.score());
            assertThat(codesOf(lowScore)).contains(SuitabilityReasonCode.LOW_SOCIALITY_CROWD);
        }

        @Test
        @DisplayName("소음 민감과 사회성 낮음이 겹치면 둘 다 깎인다 - 위험이 실제로 더 크다")
        void noiseAndLowSocialityStack() {
            SuitabilityInput both = SuitabilityInput.builder()
                .place(allowedPlace())
                .pet(PetCondition.builder().noiseSensitive(true)
                    .sociality(com.hondigagae.shared.travel.pet.SocialityLevel.LOW).build())
                .weather(mildWeather())
                .congestion(CongestionSnapshot.of(DATE, 85.0)).thresholds(thresholds()).build();

            SuitabilityScore score = SuitabilityEvaluator.evaluate(both);

            assertThat(codesOf(score)).contains(
                SuitabilityReasonCode.NOISE_SENSITIVE_CROWD, SuitabilityReasonCode.LOW_SOCIALITY_CROWD);
        }

        @Test
        @DisplayName("사회성 보통/높음은 혼잡 감점에 영향이 없다 - 제약이 아니다")
        void mediumSocialityDoesNotPenalize() {
            SuitabilityInput medium = SuitabilityInput.builder()
                .place(allowedPlace())
                .pet(PetCondition.builder()
                    .sociality(com.hondigagae.shared.travel.pet.SocialityLevel.MEDIUM).build())
                .weather(mildWeather())
                .congestion(CongestionSnapshot.of(DATE, 85.0)).thresholds(thresholds()).build();

            assertThat(codesOf(SuitabilityEvaluator.evaluate(medium)))
                .doesNotContain(SuitabilityReasonCode.LOW_SOCIALITY_CROWD);
        }
    }

    @Nested
    @DisplayName("예보 출처")
    class ForecastSourceRules {

        @Test
        @DisplayName("중기예보로 판정하면 그 사실이 근거에 남는다")
        void notesMidTermEvidence() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(midTermWeather(), false, allowedPlace(), pet()));

            // 같은 점수라도 신뢰도가 다르고 습도·바람이 아예 빠진다. 그 사실을 감추면 안 된다.
            assertThat(score.score()).isNotNull();
            assertThat(codesOf(score)).contains(SuitabilityReasonCode.MID_TERM_FORECAST);
        }

        @Test
        @DisplayName("단기예보로 판정하면 중기예보 안내가 붙지 않는다")
        void doesNotNoteWhenShortTerm() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(mildWeather(), false, allowedPlace(), pet()));

            assertThat(codesOf(score)).doesNotContain(SuitabilityReasonCode.MID_TERM_FORECAST);
        }

        @Test
        @DisplayName("중기예보에 습도·바람이 없어도 판정은 성립한다")
        void scoresWithoutHumidityAndWind() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(midTermWeather(), false, outdoorPlace(), pet()));

            assertThat(score.level()).isNotEqualTo(SuitabilityLevel.INSUFFICIENT);
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
            .place(place).pet(pet).weather(weather)
            .coverage(outOfRange ? ForecastCoverage.OUT_OF_RANGE : ForecastCoverage.UNAVAILABLE)
            .congestion(CongestionSnapshot.unknown(DATE)).thresholds(thresholds()).build();
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

    /** {@code allowedPlace()} 와 추가 요금 원문만 다르다 — 점수 차이가 요금 판정에서만 나오게 한다. */
    private static PlaceCondition placeWithExtraFee(String petExtraFee) {
        return PlaceCondition.builder()
            .placeId(1L).title("천지연폭포").lat(33.24).lng(126.55)
            .petAllowanceType(PetAllowanceType.ALLOWED).allowedPetSize(AllowedPetSize.ALL)
            .petExtraFee(petExtraFee)
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

    private static PetCondition lowSocialityPet() {
        return PetCondition.builder().sociality(com.hondigagae.shared.travel.pet.SocialityLevel.LOW).build();
    }

    private static PetCondition largePet() {
        return PetCondition.builder().sizeType(PetSizeType.LARGE).build();
    }

    private static PetCondition smallPet() {
        return PetCondition.builder().sizeType(PetSizeType.SMALL).build();
    }

    private static DailyWeather mildWeather() {
        return DailyWeather.builder()
            .date(DATE).source(ForecastSource.SHORT_TERM).minTemperature(18.0d).maxTemperature(24.0d)
            .maxPrecipitationProbability(10).worstPrecipitationType(PrecipitationType.NONE)
            .representativeSkyState(SkyState.CLEAR).maxWindSpeed(3.0d).maxHumidity(55)
            .hourly(List.of())
            .build();
    }

    private static DailyWeather hotWeather() {
        return DailyWeather.builder()
            .date(DATE).source(ForecastSource.SHORT_TERM).minTemperature(26.0d).maxTemperature(33.0d)
            .maxPrecipitationProbability(10).worstPrecipitationType(PrecipitationType.NONE)
            .representativeSkyState(SkyState.CLEAR).maxWindSpeed(3.0d).maxHumidity(80)
            .hourly(List.of())
            .build();
    }

    /** 기온 30도·습도 95% — 기상청 여름철 체감온도 33.2도로 매우 더움 임계(31도)를 넘는 날. */
    private static DailyWeather humidHotWeather() {
        return DailyWeather.builder()
            .date(DATE).source(ForecastSource.SHORT_TERM).minTemperature(26.0d).maxTemperature(30.0d)
            .maxPrecipitationProbability(10).worstPrecipitationType(PrecipitationType.NONE)
            .representativeSkyState(SkyState.CLEAR).maxWindSpeed(3.0d).maxHumidity(95)
            .hourly(List.of(reading(14, 30.0d, 95)))
            .build();
    }

    /** {@code humidHotWeather()} 와 기온은 같고 습도만 다르다 — 체감 28.5도라 기온 규칙에 머문다. */
    private static DailyWeather dryHotWeather() {
        return DailyWeather.builder()
            .date(DATE).source(ForecastSource.SHORT_TERM).minTemperature(26.0d).maxTemperature(30.0d)
            .maxPrecipitationProbability(10).worstPrecipitationType(PrecipitationType.NONE)
            .representativeSkyState(SkyState.CLEAR).maxWindSpeed(3.0d).maxHumidity(40)
            .hourly(List.of(reading(14, 30.0d, 40)))
            .build();
    }

    /** 기온 27도·습도 95% — 기온은 임계(28도) 아래인데 체감 30.1도로 넘는 날. */
    private static DailyWeather humidWarmWeather() {
        return DailyWeather.builder()
            .date(DATE).source(ForecastSource.SHORT_TERM).minTemperature(23.0d).maxTemperature(27.0d)
            .maxPrecipitationProbability(10).worstPrecipitationType(PrecipitationType.NONE)
            .representativeSkyState(SkyState.CLEAR).maxWindSpeed(3.0d).maxHumidity(95)
            .hourly(List.of(reading(14, 27.0d, 95)))
            .build();
    }

    /** 기온 33도·습도 60% — 기온도 체감(33.5도)도 매우 더움 임계를 넘는 날. */
    private static DailyWeather veryHotWeather() {
        return DailyWeather.builder()
            .date(DATE).source(ForecastSource.SHORT_TERM).minTemperature(26.0d).maxTemperature(33.0d)
            .maxPrecipitationProbability(10).worstPrecipitationType(PrecipitationType.NONE)
            .representativeSkyState(SkyState.CLEAR).maxWindSpeed(3.0d).maxHumidity(60)
            .hourly(List.of(reading(14, 33.0d, 60)))
            .build();
    }

    /** 기온 29도·습도 40% — 체감 27.6도로 기온보다 낮아 기온 규칙만 걸리는 날. */
    private static DailyWeather dryWarmWeather() {
        return DailyWeather.builder()
            .date(DATE).source(ForecastSource.SHORT_TERM).minTemperature(24.0d).maxTemperature(29.0d)
            .maxPrecipitationProbability(10).worstPrecipitationType(PrecipitationType.NONE)
            .representativeSkyState(SkyState.CLEAR).maxWindSpeed(3.0d).maxHumidity(40)
            .hourly(List.of(reading(14, 29.0d, 40)))
            .build();
    }

    /**
     * 최고기온이 비어 있고 시각별 값만 있는 날 — 체감 36.0도로만 판정해야 한다.
     *
     * <p>원천이 TMX 를 주지 않는 경우를 가정한 방어 분기다. 기온이 없다고 더위를 놓치면
     * 안 되고, 문장에 없는 기온을 지어내서도 안 된다.
     */
    private static DailyWeather feelsLikeOnlyWeather() {
        return DailyWeather.builder()
            .date(DATE).source(ForecastSource.SHORT_TERM).minTemperature(27.0d)
            .maxPrecipitationProbability(10).worstPrecipitationType(PrecipitationType.NONE)
            .representativeSkyState(SkyState.CLEAR).maxWindSpeed(3.0d).maxHumidity(90)
            .hourly(List.of(reading(14, 33.0d, 90)))
            .build();
    }

    /** 중기예보의 더운 날 — 시각별 습도가 없어 체감온도가 null 이다. */
    private static DailyWeather midTermHotWeather() {
        return DailyWeather.builder()
            .date(DATE).source(ForecastSource.MID_TERM).minTemperature(26.0d).maxTemperature(33.0d)
            .maxPrecipitationProbability(20).worstPrecipitationType(PrecipitationType.NONE)
            .representativeSkyState(SkyState.MOSTLY_CLOUDY)
            .hourly(List.of())
            .build();
    }

    private static WeatherForecast reading(int hour, Double temperature, Integer humidity) {
        return WeatherForecast.builder()
            .nx(52).ny(38)
            .forecastAt(DATE.atTime(hour, 0)).baseAt(DATE.atTime(5, 0))
            .temperature(temperature).humidity(humidity)
            .precipitationType(PrecipitationType.NONE).skyState(SkyState.CLEAR)
            .build();
    }

    /** 중기예보 — 습도와 바람이 없고 시각별 데이터도 없다. */
    private static DailyWeather midTermWeather() {
        return DailyWeather.builder()
            .date(DATE).source(ForecastSource.MID_TERM)
            .minTemperature(19.0d).maxTemperature(25.0d)
            .maxPrecipitationProbability(20).worstPrecipitationType(PrecipitationType.NONE)
            .representativeSkyState(SkyState.MOSTLY_CLOUDY)
            .hourly(List.of())
            .build();
    }

    private static DailyWeather rainyWeather() {
        return DailyWeather.builder()
            .date(DATE).source(ForecastSource.SHORT_TERM).minTemperature(20.0d).maxTemperature(24.0d)
            .maxPrecipitationProbability(80).worstPrecipitationType(PrecipitationType.RAIN)
            .representativeSkyState(SkyState.OVERCAST).maxWindSpeed(4.0d).maxHumidity(90)
            .hourly(List.of())
            .build();
    }
}

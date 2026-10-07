package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SuitabilityReasonCode;
import com.hondigagae.shared.travel.insight.ForecastSource;
import com.hondigagae.shared.travel.insight.SuitabilityLevel;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * 적합도 결론 문구 (#1234).
 *
 * <p>고정하는 것은 셋이다.
 * <ul>
 *   <li><b>판단 근거가 없으면 문구를 만들지 않는다</b> — null 이고, 화면은 등급명으로 폴백한다. 단 날씨와 무관하게
 *       아는 사실(출입 · 발효 중인 특보)은 그때도 말한다
 *   <li><b>결론을 뒤집는 사실이 등급 문구보다 먼저다</b> — 동반 불가 &gt; 기상특보 &gt; 크기 제한 &gt; 동반 미확인.
 *       등급 문구 바로 밑에 그와 반대되는 사실이 붙던 것이 #1233 결함이다
 *   <li><b>"오늘" 은 기준 일자가 오늘일 때만 쓴다</b> — 다른 날짜를 넣는 소비처가 있다
 * </ul>
 */
class SuitabilityHeadlineTest {

    private static final LocalDate DATE = LocalDate.of(2026, 8, 27);

    @Nested
    @DisplayName("등급 문구")
    class ByLevel {

        @ParameterizedTest(name = "{1}점({0}), 오늘={2} → {3}")
        @CsvSource({
            "HIGH,   92, true,  오늘 가기 좋아요",
            "HIGH,   92, false, 가기 좋아요",
            "MEDIUM, 70, true,  가도 괜찮지만 챙길 게 있어요",
            "MEDIUM, 70, false, 가도 괜찮지만 챙길 게 있어요",
            "LOW,    40, true,  오늘은 다른 곳이 더 나아요",
            "LOW,    40, false, 다른 곳이 더 나아요"
        })
        void followsLevel(SuitabilityLevel level, int points, boolean today, String expected) {
            SuitabilityScore score = scored(points, allowed());
            // 입력 점수가 의도한 등급에 떨어지는지부터 확인한다 - 등급 경계가 바뀌면 이 표가 거짓이 된다.
            assertThat(score.level()).isEqualTo(level);

            assertThat(SuitabilityHeadline.of(score, false, today)).isEqualTo(expected);
        }

        @Test
        @DisplayName("결론을 뒤집지 않는 감점(더위 · 혼잡 · 부분 동반 · 추가 요금)은 등급 문구를 따른다")
        void ordinaryPenaltiesKeepLevelHeadline() {
            SuitabilityScore score = scored(62,
                SuitabilityReason.of(SuitabilityReasonCode.PET_PARTIALLY_ALLOWED, "일부 구역만 동반이 가능합니다.", -20),
                SuitabilityReason.of(SuitabilityReasonCode.HEAT_RISK, "최고기온 29도 로 더위에 주의가 필요합니다.", -15),
                SuitabilityReason.of(SuitabilityReasonCode.PET_EXTRA_FEE, "반려견 동반 추가 요금이 있습니다 (5,000원).", -3));

            assertThat(SuitabilityHeadline.of(score, false, true)).isEqualTo("가도 괜찮지만 챙길 게 있어요");
        }
    }

    @Nested
    @DisplayName("판단 근거가 없을 때")
    class WhenInsufficient {

        @ParameterizedTest(name = "오늘={0}")
        @ValueSource(booleans = {true, false})
        @DisplayName("INSUFFICIENT 면 null 이다 - 모르는 것을 결론으로 말하지 않는다")
        void returnsNull(boolean today) {
            SuitabilityScore score = SuitabilityScore.insufficient(List.of(
                SuitabilityReason.informational(SuitabilityReasonCode.PET_ALLOWED, "반려견 출입이 확인된 장소입니다."),
                SuitabilityReason.informational(SuitabilityReasonCode.FORECAST_OUT_OF_RANGE, "예보 범위 밖입니다.")));

            assertThat(SuitabilityHeadline.of(score, false, today)).isNull();
        }

        @Test
        @DisplayName("날씨를 몰라도 동반 불가는 결론으로 말한다 - 날씨와 무관하게 아는 사실이다")
        void decisivePetFactWinsOverInsufficient() {
            SuitabilityScore score = SuitabilityScore.insufficient(List.of(
                SuitabilityReason.of(SuitabilityReasonCode.PET_NOT_ALLOWED, "반려견 출입이 불가능한 장소로 등록되어 있습니다.", -60),
                SuitabilityReason.informational(SuitabilityReasonCode.FORECAST_UNAVAILABLE, "날씨 정보를 가져오지 못했습니다.")));

            assertThat(SuitabilityHeadline.of(score, false, true)).isEqualTo("반려견과 함께 들어갈 수 없는 곳이에요");
        }

        @Test
        @DisplayName("날씨를 몰라도 크기 제한 감점은 결론으로 말한다")
        void sizeRestrictionWinsOverInsufficient() {
            SuitabilityScore score = SuitabilityScore.insufficient(List.of(
                SuitabilityReason.of(SuitabilityReasonCode.PET_SIZE_RESTRICTED, "소형견만 조건이라 몽(중형견)는 입장이 어려울 수 있습니다.", -30),
                SuitabilityReason.informational(SuitabilityReasonCode.FORECAST_DAY_ENDED, "남은 예보 없음")));

            assertThat(SuitabilityHeadline.of(score, false, false)).isEqualTo("반려견 크기 제한이 있어 확인이 필요해요");
        }

        @Test
        @DisplayName("날씨를 몰라도 발효 중인 특보는 말한다 - 판정기는 날씨가 없으면 특보를 근거로 남기지 않는다")
        void activeWarningWinsOverInsufficient() {
            SuitabilityScore score = SuitabilityScore.insufficient(List.of(
                allowed(),
                SuitabilityReason.informational(SuitabilityReasonCode.FORECAST_DAY_ENDED, "남은 예보 없음")));
            // 전제: 특보는 근거에 없다 - 발효 여부만으로 말해야 한다
            assertThat(score.reasons()).extracting(SuitabilityReason::code).doesNotContain(SuitabilityReasonCode.WEATHER_WARNING_ACTIVE);

            assertThat(SuitabilityHeadline.of(score, true, true)).isEqualTo("기상특보가 있어 오늘은 바깥 활동을 줄이는 게 좋아요");
        }
    }

    @Nested
    @DisplayName("결론을 뒤집는 감점")
    class DecisivePenalty {

        @Test
        @DisplayName("동반 불가가 특보 · 크기 제한보다 먼저다 - 영향이 더 큰 경보가 앞에 정렬돼 있어도 그렇다")
        void notAllowedComesFirst() {
            SuitabilityScore score = scored(0,
                warning(-100),
                SuitabilityReason.of(SuitabilityReasonCode.PET_NOT_ALLOWED, "반려견 출입이 불가능한 장소로 등록되어 있습니다.", -60),
                sizeRestricted(-40));
            // 전제: 영향 순 정렬로 경보가 맨 앞이다. 우선순위는 정렬이 아니라 사실의 결정성으로 정한다.
            assertThat(score.reasons().get(0).code()).isEqualTo(SuitabilityReasonCode.WEATHER_WARNING_ACTIVE);

            assertThat(SuitabilityHeadline.of(score, false, true)).isEqualTo("반려견과 함께 들어갈 수 없는 곳이에요");
            assertThat(SuitabilityHeadline.of(score, false, false)).isEqualTo("반려견과 함께 들어갈 수 없는 곳이에요");
        }

        @Test
        @DisplayName("특보가 크기 제한보다 먼저다")
        void warningComesBeforeSizeRestriction() {
            SuitabilityScore score = scored(15, sizeRestricted(-40), warning(-45));

            assertThat(SuitabilityHeadline.of(score, false, true)).isEqualTo("기상특보가 있어 오늘은 바깥 활동을 줄이는 게 좋아요");
        }

        @Test
        @DisplayName("특보 문구도 오늘이 아니면 '오늘은' 을 빼고 말한다")
        void warningDropsTodayForOtherDates() {
            // 특보는 오늘 판정에만 붙는다(PlaceSuitabilityProcessor). 그래도 다른 날짜로 이 근거가 오면 "오늘" 이 거짓이 된다.
            SuitabilityScore score = scored(55, warning(-45));

            assertThat(SuitabilityHeadline.of(score, false, false)).isEqualTo("기상특보가 있어 바깥 활동을 줄이는 게 좋아요");
        }

        @Test
        @DisplayName("크기 제한 감점이 있으면 등급 문구 대신 확인을 권한다")
        void sizeRestrictionPenalty() {
            SuitabilityScore score = scored(60, allowed(), sizeRestricted(-40));
            assertThat(score.level()).isEqualTo(SuitabilityLevel.MEDIUM);

            assertThat(SuitabilityHeadline.of(score, false, true)).isEqualTo("반려견 크기 제한이 있어 확인이 필요해요");
        }

        @Test
        @DisplayName("동반 여부를 모르면 날씨가 좋아도 확인을 권한다 - 반려견 여행에서 '가기 좋아요' 는 들어갈 수 있다는 말이다")
        void allowanceUnknownOverridesGoodLevel() {
            SuitabilityScore score = scored(90,
                SuitabilityReason.of(SuitabilityReasonCode.PET_ALLOWANCE_UNKNOWN, "동반 가능 여부가 원천에 없습니다.", -10));
            assertThat(score.level()).isEqualTo(SuitabilityLevel.HIGH);

            assertThat(SuitabilityHeadline.of(score, false, true)).isEqualTo("반려견 동반 여부를 확인하고 가세요");
        }

        @Test
        @DisplayName("점수에 영향이 없는 크기 제한 안내(delta 0)는 결론을 바꾸지 않는다")
        void informationalSizeRestrictionIsIgnored() {
            SuitabilityScore score = scored(100, allowed(),
                SuitabilityReason.informational(SuitabilityReasonCode.PET_SIZE_RESTRICTED, "소형견만 가능 조건이 있는 장소입니다."));

            assertThat(SuitabilityHeadline.of(score, false, true)).isEqualTo("오늘 가기 좋아요");
        }
    }

    @Nested
    @DisplayName("판정기가 실제로 내는 근거로")
    class WithEvaluator {

        @Test
        @DisplayName("동반 불가 장소는 맑은 날에도 동반 불가를 결론으로 말한다")
        void notAllowedPlaceOnMildDay() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(input(place(PetAllowanceType.NOT_ALLOWED, null)));

            assertThat(score.level()).isEqualTo(SuitabilityLevel.LOW);
            assertThat(SuitabilityHeadline.of(score, false, true)).isEqualTo("반려견과 함께 들어갈 수 없는 곳이에요");
        }

        @Test
        @DisplayName("반려견 크기를 모르면 크기 제한은 안내뿐이라 등급 문구가 나간다")
        void sizeRestrictionWithoutPetSizeIsInformational() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(
                input(place(PetAllowanceType.ALLOWED, AllowedPetSize.SMALL_ONLY)));

            assertThat(score.reasons()).extracting(SuitabilityReason::code).contains(SuitabilityReasonCode.PET_SIZE_RESTRICTED);
            assertThat(SuitabilityHeadline.of(score, false, true)).isEqualTo("오늘 가기 좋아요");
        }

        @Test
        @DisplayName("동반 정보가 없는 장소는 맑은 날 HIGH 여도 동반 확인을 결론으로 말한다")
        void allowanceUnknownPlaceOnMildDay() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(input(place(PetAllowanceType.UNKNOWN, null)));

            assertThat(score.level()).isEqualTo(SuitabilityLevel.HIGH);
            assertThat(SuitabilityHeadline.of(score, false, true)).isEqualTo("반려견 동반 여부를 확인하고 가세요");
        }

        @Test
        @DisplayName("부분 동반은 들어갈 수 있는 곳이라 등급 문구를 따른다")
        void partiallyAllowedPlaceKeepsLevelHeadline() {
            SuitabilityScore score = SuitabilityEvaluator.evaluate(input(place(PetAllowanceType.PARTIALLY_ALLOWED, null)));

            assertThat(score.level()).isEqualTo(SuitabilityLevel.HIGH);
            assertThat(SuitabilityHeadline.of(score, false, true)).isEqualTo("오늘 가기 좋아요");
        }
    }

    private static SuitabilityScore scored(int points, SuitabilityReason... reasons) {
        return SuitabilityScore.scored(points, List.of(reasons), true, false);
    }

    private static SuitabilityReason allowed() {
        return SuitabilityReason.informational(SuitabilityReasonCode.PET_ALLOWED, "반려견 출입이 확인된 장소입니다.");
    }

    private static SuitabilityReason warning(int delta) {
        return SuitabilityReason.of(SuitabilityReasonCode.WEATHER_WARNING_ACTIVE, "호우 주의보 발효 중입니다.", delta);
    }

    private static SuitabilityReason sizeRestricted(int delta) {
        return SuitabilityReason.of(SuitabilityReasonCode.PET_SIZE_RESTRICTED, "소형견만 가능 조건이라 입장이 어려울 수 있습니다.", delta);
    }

    private static PlaceCondition place(PetAllowanceType allowanceType, AllowedPetSize allowedPetSize) {
        return PlaceCondition.builder()
            .placeId(1L)
            .title("테스트 장소")
            .lat(33.45d)
            .lng(126.56d)
            .petAllowanceType(allowanceType)
            .allowedPetSize(allowedPetSize)
            .outdoor(true)
            .build();
    }

    private static SuitabilityInput input(PlaceCondition place) {
        DailyWeather mild = DailyWeather.builder()
            .date(DATE)
            .source(ForecastSource.SHORT_TERM)
            .minTemperature(18.0d)
            .maxTemperature(24.0d)
            .maxPrecipitationProbability(10)
            .worstPrecipitationType(PrecipitationType.NONE)
            .maxWindSpeed(2.0d)
            .build();
        return SuitabilityInput.builder()
            .place(place)
            .pet(PetCondition.unspecified())
            .weather(mild)
            .coverage(ForecastCoverage.AVAILABLE)
            .thresholds(SuitabilityThresholds.builder()
                .rainProbabilityPercent(60)
                .hotTemperature(28.0d).veryHotTemperature(31.0d)
                .coldTemperature(5.0d).veryColdTemperature(0.0d)
                .strongWindSpeed(9.0d)
                .build())
            .build();
    }
}

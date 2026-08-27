package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.CongestionLevel;
import com.hondigagae.domainlayer.insight.domain.enums.SuitabilityReasonCode;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.util.ArrayList;
import java.util.List;

/**
 * 여행 적합도 산출 - 규칙 기반.
 *
 * <p><b>LLM 을 쓰지 않는다.</b> 점수와 근거는 데이터에서 결정론적으로 나와야 한다
 * (services/tour-service.md). ai-service 는 이 결과를 받아 문장을 다듬을 뿐이고,
 * 같은 입력에 같은 점수가 나오는 성질은 여기서 지킨다.
 *
 * <p>감점 방식인 이유는 근거를 만들기 쉬워서다. 100 에서 빼면 "무엇 때문에 깎였는지"가
 * 그대로 근거 목록이 된다. 가점 방식은 "왜 90점인가"에 답하기 어렵다.
 *
 * <p>날씨가 없으면 점수를 내지 않는다({@link SuitabilityScore#insufficient}). 동반 조건만으로
 * 낸 점수를 날씨까지 본 점수와 같은 척도에 올리면 둘을 비교할 수 없게 된다.
 */
public final class SuitabilityEvaluator {

    private static final int BASE_SCORE = 100;
    private static final int MIN_SCORE = 0;

    // 동반 조건 감점
    private static final int PENALTY_NOT_ALLOWED = 60;
    private static final int PENALTY_PARTIALLY_ALLOWED = 20;
    private static final int PENALTY_ALLOWANCE_UNKNOWN = 10;
    private static final int PENALTY_SIZE_RESTRICTED = 40;
    private static final int PENALTY_EXTRA_FEE = 3;

    // 날씨 감점 (실외 노출 기준. 실내 피난처가 있으면 절반으로 줄인다)
    private static final int PENALTY_RAIN = 25;
    private static final int PENALTY_WET = 10;
    private static final int PENALTY_VERY_HOT = 30;
    private static final int PENALTY_HOT = 15;
    private static final int PENALTY_VERY_COLD = 30;
    private static final int PENALTY_COLD = 15;
    private static final int PENALTY_SENSITIVE_EXTRA = 12;
    private static final int PENALTY_STRONG_WIND = 10;

    // 혼잡도 감점
    private static final int PENALTY_HIGH_CONGESTION = 15;
    private static final int PENALTY_NOISE_SENSITIVE_CROWD = 10;

    private SuitabilityEvaluator() {
    }

    public static SuitabilityScore evaluate(SuitabilityInput input) {
        List<SuitabilityReason> reasons = new ArrayList<>();
        int penalty = applyPetAllowance(input, reasons);

        boolean weatherApplied = input.weather() != null;
        if (!weatherApplied) {
            // 날씨를 못 쓴 이유를 근거로 남긴다. 조용히 빠지면 사용자는 날씨를 본 줄 안다.
            reasons.add(SuitabilityReason.informational(
                input.forecastOutOfRange()
                    ? SuitabilityReasonCode.FORECAST_OUT_OF_RANGE
                    : SuitabilityReasonCode.FORECAST_UNAVAILABLE,
                input.forecastOutOfRange()
                    ? "예보는 약 11일까지만 제공되어 이 날짜의 날씨는 근거로 쓰지 못했습니다."
                    : "날씨 정보를 가져오지 못해 날씨를 근거로 쓰지 못했습니다."));
            return SuitabilityScore.insufficient(reasons);
        }

        penalty += applyWeather(input, reasons);
        noteMidTermEvidence(input, reasons);
        boolean congestionApplied = input.congestion() != null && input.congestion().isKnown();
        penalty += applyCongestion(input, reasons, congestionApplied);

        int score = Math.max(MIN_SCORE, BASE_SCORE - penalty);
        return SuitabilityScore.scored(score, reasons, true, congestionApplied);
    }

    /**
     * 중기예보로 판정했으면 그 사실을 근거에 남긴다.
     *
     * <p>같은 점수라도 신뢰도가 다르고, 중기예보에는 습도와 풍속이 없어 열지수 보정과 강풍
     * 감점이 아예 빠진다. 점수만 주고 이 사실을 감추면 사용자가 근거를 과대평가한다.
     */
    private static void noteMidTermEvidence(SuitabilityInput input, List<SuitabilityReason> reasons) {
        DailyWeather weather = input.weather();
        if (weather == null || weather.source() == null || weather.source().supportsHourlyJudgement()) {
            return;
        }
        reasons.add(SuitabilityReason.informational(SuitabilityReasonCode.MID_TERM_FORECAST,
            "3일 이후 중기예보로 판정했습니다. 오전/오후 단위라 대략적이고 습도와 바람은 반영되지 않았습니다."));
    }

    private static int applyPetAllowance(SuitabilityInput input, List<SuitabilityReason> reasons) {
        PlaceCondition place = input.place();
        PetCondition pet = input.pet();
        int penalty = 0;

        PetAllowanceType allowanceType =
            place.petAllowanceType() == null ? PetAllowanceType.UNKNOWN : place.petAllowanceType();
        switch (allowanceType) {
            case ALLOWED -> reasons.add(SuitabilityReason.informational(
                SuitabilityReasonCode.PET_ALLOWED, "반려견 출입이 확인된 장소입니다."));
            case PARTIALLY_ALLOWED -> {
                penalty += PENALTY_PARTIALLY_ALLOWED;
                reasons.add(SuitabilityReason.of(SuitabilityReasonCode.PET_PARTIALLY_ALLOWED,
                    describeRestriction(place, "일부 구역 또는 조건부로만 동반이 가능합니다."), -PENALTY_PARTIALLY_ALLOWED));
            }
            case NOT_ALLOWED -> {
                penalty += PENALTY_NOT_ALLOWED;
                reasons.add(SuitabilityReason.of(SuitabilityReasonCode.PET_NOT_ALLOWED,
                    "반려견 출입이 불가능한 장소로 등록되어 있습니다.", -PENALTY_NOT_ALLOWED));
            }
            case UNKNOWN -> {
                penalty += PENALTY_ALLOWANCE_UNKNOWN;
                reasons.add(SuitabilityReason.of(SuitabilityReasonCode.PET_ALLOWANCE_UNKNOWN,
                    "동반 가능 여부가 원천에 없어 방문 전 확인이 필요합니다.", -PENALTY_ALLOWANCE_UNKNOWN));
            }
        }

        // 크기 제한은 반려견 크기를 알 때만 판정한다. 모르면 제한이 있다는 사실만 알린다.
        if (place.allowedPetSize() != null && place.allowedPetSize().hasRestriction()) {
            if (pet.sizeType() != null && !place.allowedPetSize().allows(pet.sizeType())) {
                penalty += PENALTY_SIZE_RESTRICTED;
                reasons.add(SuitabilityReason.of(SuitabilityReasonCode.PET_SIZE_RESTRICTED,
                    "%s 조건이라 %s(%s)는 입장이 어려울 수 있습니다."
                        .formatted(place.allowedPetSize().getDisplayName(), pet.subject(),
                            pet.sizeType().getDisplayName()),
                    -PENALTY_SIZE_RESTRICTED));
            } else {
                reasons.add(SuitabilityReason.informational(SuitabilityReasonCode.PET_SIZE_RESTRICTED,
                    "%s 조건이 있는 장소입니다.".formatted(place.allowedPetSize().getDisplayName())));
            }
        }

        if (place.hasExtraFee()) {
            penalty += PENALTY_EXTRA_FEE;
            reasons.add(SuitabilityReason.of(SuitabilityReasonCode.PET_EXTRA_FEE,
                "반려견 동반 추가 요금이 있습니다 (%s).".formatted(place.petExtraFee()), -PENALTY_EXTRA_FEE));
        }
        return penalty;
    }

    private static int applyWeather(SuitabilityInput input, List<SuitabilityReason> reasons) {
        DailyWeather weather = input.weather();
        PlaceCondition place = input.place();
        PetCondition pet = input.pet();
        SuitabilityThresholds thresholds = input.thresholds();

        boolean sheltered = place.hasIndoorShelter();
        int penalty = 0;
        boolean anyWeatherPenalty = false;

        Integer rainChance = weather.maxPrecipitationProbability();
        if (rainChance != null && rainChance >= thresholds.rainProbabilityPercent()) {
            int amount = shelterAdjusted(PENALTY_RAIN, sheltered);
            penalty += amount;
            anyWeatherPenalty = true;
            reasons.add(SuitabilityReason.of(SuitabilityReasonCode.RAIN_EXPECTED,
                "강수확률 %d%%%s".formatted(rainChance, sheltered ? " 이지만 실내 공간이 있어 영향이 적습니다." : " 로 야외 일정에 영향이 있습니다."),
                -amount));
        }
        if (weather.worstPrecipitationType() != null && weather.worstPrecipitationType().isWet()
            && (rainChance == null || rainChance < thresholds.rainProbabilityPercent())) {
            int amount = shelterAdjusted(PENALTY_WET, sheltered);
            penalty += amount;
            anyWeatherPenalty = true;
            reasons.add(SuitabilityReason.of(SuitabilityReasonCode.RAIN_EXPECTED,
                "%s 예보가 있습니다.".formatted(weather.worstPrecipitationType().getDisplayName()), -amount));
        }

        Double highest = weather.maxTemperature();
        if (highest != null) {
            int amount = 0;
            if (highest >= thresholds.veryHotTemperature()) {
                amount = PENALTY_VERY_HOT;
            } else if (highest >= thresholds.hotTemperature()) {
                amount = PENALTY_HOT;
            }
            if (amount > 0) {
                if (pet.heatSensitive()) {
                    amount += PENALTY_SENSITIVE_EXTRA;
                }
                amount = shelterAdjusted(amount, sheltered);
                penalty += amount;
                anyWeatherPenalty = true;
                reasons.add(SuitabilityReason.of(SuitabilityReasonCode.HEAT_RISK,
                    "최고기온 %.0f도%s".formatted(highest,
                        pet.heatSensitive() ? " 로, 더위에 약한 아이에게는 부담이 큽니다." : " 로 더위에 주의가 필요합니다."),
                    -amount));
            }
        }

        Double lowest = weather.minTemperature();
        if (lowest != null) {
            int amount = 0;
            if (lowest <= thresholds.veryColdTemperature()) {
                amount = PENALTY_VERY_COLD;
            } else if (lowest <= thresholds.coldTemperature()) {
                amount = PENALTY_COLD;
            }
            if (amount > 0) {
                if (pet.coldSensitive()) {
                    amount += PENALTY_SENSITIVE_EXTRA;
                }
                amount = shelterAdjusted(amount, sheltered);
                penalty += amount;
                anyWeatherPenalty = true;
                reasons.add(SuitabilityReason.of(SuitabilityReasonCode.COLD_RISK,
                    "최저기온 %.0f도%s".formatted(lowest,
                        pet.coldSensitive() ? " 로, 추위에 약한 아이에게는 부담이 큽니다." : " 로 추위에 주의가 필요합니다."),
                    -amount));
            }
        }

        Double wind = weather.maxWindSpeed();
        if (wind != null && wind >= thresholds.strongWindSpeed() && place.isWeatherExposed()) {
            penalty += PENALTY_STRONG_WIND;
            anyWeatherPenalty = true;
            reasons.add(SuitabilityReason.of(SuitabilityReasonCode.WIND_STRONG,
                "최대 풍속 %.0fm/s 로 소형견 산책에 주의가 필요합니다.".formatted(wind), -PENALTY_STRONG_WIND));
        }

        if (!anyWeatherPenalty) {
            reasons.add(SuitabilityReason.informational(SuitabilityReasonCode.WEATHER_OK,
                describeMildWeather(weather)));
        } else if (sheltered) {
            reasons.add(SuitabilityReason.informational(SuitabilityReasonCode.INDOOR_SHELTER,
                "실내 공간이 있어 날씨 영향을 덜 받습니다."));
        }
        return penalty;
    }

    private static int applyCongestion(SuitabilityInput input, List<SuitabilityReason> reasons, boolean applied) {
        if (!applied) {
            reasons.add(SuitabilityReason.informational(SuitabilityReasonCode.CONGESTION_UNAVAILABLE,
                "이 장소에 연결된 혼잡도 예측 데이터가 없어 근거로 쓰지 못했습니다."));
            return 0;
        }

        CongestionSnapshot congestion = input.congestion();
        CongestionLevel level = congestion.level();
        if (level == CongestionLevel.HIGH) {
            int penalty = PENALTY_HIGH_CONGESTION;
            reasons.add(SuitabilityReason.of(SuitabilityReasonCode.HIGH_CONGESTION,
                "관광객 집중률 %.0f%% 로 붐빌 것으로 예상됩니다.".formatted(congestion.concentrationRate()),
                -PENALTY_HIGH_CONGESTION));
            if (input.pet().noiseSensitive()) {
                penalty += PENALTY_NOISE_SENSITIVE_CROWD;
                reasons.add(SuitabilityReason.of(SuitabilityReasonCode.NOISE_SENSITIVE_CROWD,
                    "소음에 민감한 아이라 붐비는 시간대는 피하는 편이 좋습니다.", -PENALTY_NOISE_SENSITIVE_CROWD));
            }
            return penalty;
        }
        if (level == CongestionLevel.LOW) {
            reasons.add(SuitabilityReason.informational(SuitabilityReasonCode.LOW_CONGESTION,
                "관광객 집중률 %.0f%% 로 여유로운 편입니다.".formatted(congestion.concentrationRate())));
        }
        return 0;
    }

    /** 실내 공간이 있으면 날씨 감점을 절반으로 줄인다. 없애지는 않는다 - 오가는 길은 여전히 밖이다. */
    private static int shelterAdjusted(int penalty, boolean sheltered) {
        return sheltered ? Math.round(penalty / 2f) : penalty;
    }

    private static String describeMildWeather(DailyWeather weather) {
        if (weather.maxTemperature() == null) {
            return "특별히 주의할 날씨 조건이 확인되지 않았습니다.";
        }
        Integer rainChance = weather.maxPrecipitationProbability();
        return "최고기온 %.0f도, 강수확률 %s 로 반려견 활동에 무리가 없는 조건입니다."
            .formatted(weather.maxTemperature(), rainChance == null ? "정보 없음" : rainChance + "%");
    }

    private static String describeRestriction(PlaceCondition place, String fallback) {
        return place.petRestriction() != null && !place.petRestriction().isBlank()
            ? "%s (%s)".formatted(fallback, place.petRestriction())
            : fallback;
    }
}

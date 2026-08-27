package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.WalkSafetyReasonCode;
import com.hondigagae.shared.travel.insight.WalkSafetyLevel;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * 산책 위험도 판정 - 규칙 기반.
 *
 * <p>적합도와 달리 점수를 내지 않고 등급만 낸다. "산책해도 되는가"는 정도의 문제가 아니라
 * 임계를 넘었는지의 문제이고, 73점 같은 값은 판단에 도움이 되지 않기 때문이다.
 *
 * <p>판정에 쓰는 것 셋: 추정 노면온도({@link PavementHeat}), 열지수({@link HeatIndex}),
 * 반려견 개별 조건(민감도/견종). 모두 근거 수치를 문장에 넣어 돌려준다.
 */
public final class WalkSafetyEvaluator {

    /** 안전 시간대를 찾을 때 이 등급 이하만 후보로 본다. */
    private static final WalkSafetyLevel SAFER_WINDOW_MAX_LEVEL = WalkSafetyLevel.CAUTION;

    private WalkSafetyEvaluator() {
    }

    /**
     * @param at       판정 기준 시각
     * @param hourly   같은 날의 시각별 예보. 안전 시간대를 찾는 데 쓴다
     * @param forecast 기준 시각에 가장 가까운 예보. null 이면 판단하지 않는다
     */
    public static WalkSafetyAssessment evaluate(
        WeatherForecast forecast, List<WeatherForecast> hourly, PetCondition pet,
        SuitabilityThresholds thresholds, LocalDateTime at, boolean forecastOutOfRange
    ) {
        if (forecast == null || forecast.temperature() == null) {
            return WalkSafetyAssessment.unknown(List.of(WalkSafetyReason.of(
                forecastOutOfRange ? WalkSafetyReasonCode.FORECAST_OUT_OF_RANGE
                    : WalkSafetyReasonCode.FORECAST_UNAVAILABLE,
                forecastOutOfRange
                    ? "단기예보는 약 3일까지만 제공되어 이 시각의 위험도는 판단하지 못했습니다."
                    : "날씨 정보를 가져오지 못해 위험도를 판단하지 못했습니다.")));
        }

        List<WalkSafetyReason> reasons = new ArrayList<>();
        double airTemperature = forecast.temperature();
        PavementHeat pavement = PavementHeat.estimate(
            airTemperature, forecast.skyState(), forecast.isWet(), at.getHour());
        HeatIndex heatIndex = HeatIndex.of(airTemperature, forecast.humidity());

        WalkSafetyLevel level = WalkSafetyLevel.SAFE;
        level = level.worseOf(assessPavement(pavement, thresholds, reasons));
        level = level.worseOf(assessHeatIndex(heatIndex, airTemperature, thresholds, reasons));
        level = level.worseOf(assessPetSensitivity(pet, airTemperature, heatIndex, thresholds, reasons));
        level = level.worseOf(assessCold(airTemperature, pet, thresholds, reasons));
        level = level.worseOf(assessSurfaceAndWind(forecast, thresholds, reasons));

        if (reasons.isEmpty()) {
            reasons.add(WalkSafetyReason.of(WalkSafetyReasonCode.PAVEMENT_OK,
                "기온 %.0f도, 추정 노면온도 %.0f도로 산책에 무리가 없는 조건입니다."
                    .formatted(airTemperature, pavement.estimatedCelsius())));
        }

        Optional<SaferWindow> saferWindow = level == WalkSafetyLevel.SAFE
            ? Optional.empty()
            : findSaferWindow(hourly, pet, thresholds, at);
        saferWindow.ifPresent(window -> reasons.add(WalkSafetyReason.of(WalkSafetyReasonCode.SAFE_WINDOW,
            "같은 날 %s~%s 는 조건이 나아 산책하기 낫습니다."
                .formatted(window.start().toString(), window.end().toString()))));

        return WalkSafetyAssessment.builder()
            .level(level)
            .reasons(reasons)
            .estimatedPavementCelsius(pavement.estimatedCelsius())
            .heatIndexCelsius(heatIndex.celsius())
            .saferWindowStart(saferWindow.map(SaferWindow::start).orElse(null))
            .saferWindowEnd(saferWindow.map(SaferWindow::end).orElse(null))
            .build();
    }

    private static WalkSafetyLevel assessPavement(
        PavementHeat pavement, SuitabilityThresholds thresholds, List<WalkSafetyReason> reasons
    ) {
        double surface = pavement.estimatedCelsius();
        if (surface >= thresholds.pavementDangerCelsius()) {
            reasons.add(WalkSafetyReason.of(WalkSafetyReasonCode.PAVEMENT_HEAT,
                "기온 %.0f도에 일사가 더해져 아스팔트 표면은 약 %.0f도로 추정됩니다. 발바닥 화상 위험 구간입니다."
                    .formatted(pavement.airTemperature(), surface)));
            return WalkSafetyLevel.DANGER;
        }
        if (surface >= thresholds.pavementCautionCelsius()) {
            reasons.add(WalkSafetyReason.of(WalkSafetyReasonCode.PAVEMENT_HEAT,
                "아스팔트 표면이 약 %.0f도로 추정됩니다. 그늘길로 걷고 손등으로 지면을 확인해 주세요."
                    .formatted(surface)));
            return WalkSafetyLevel.CAUTION;
        }
        return WalkSafetyLevel.SAFE;
    }

    private static WalkSafetyLevel assessHeatIndex(
        HeatIndex heatIndex, double airTemperature, SuitabilityThresholds thresholds, List<WalkSafetyReason> reasons
    ) {
        double value = heatIndex.celsius();
        if (value < thresholds.heatIndexCautionCelsius()) {
            return WalkSafetyLevel.SAFE;
        }
        boolean adjusted = heatIndex.isAdjusted(airTemperature);
        String humidityNote = adjusted
            ? "기온 %.0f도지만 습도가 높아 체감 %.0f도 수준입니다. 반려견은 헐떡임으로 열을 내보내는데 습할수록 그 효율이 떨어집니다."
                .formatted(airTemperature, value)
            : "체감 %.0f도로 더위 부담이 있는 조건입니다.".formatted(value);

        reasons.add(WalkSafetyReason.of(WalkSafetyReasonCode.HEAT_INDEX_HIGH, humidityNote));
        return value >= thresholds.heatIndexDangerCelsius() ? WalkSafetyLevel.DANGER : WalkSafetyLevel.CAUTION;
    }

    private static WalkSafetyLevel assessPetSensitivity(
        PetCondition pet, double airTemperature, HeatIndex heatIndex,
        SuitabilityThresholds thresholds, List<WalkSafetyReason> reasons
    ) {
        if (heatIndex.celsius() < thresholds.heatIndexCautionCelsius()
            && airTemperature < thresholds.hotTemperature()) {
            return WalkSafetyLevel.SAFE;
        }

        WalkSafetyLevel level = WalkSafetyLevel.SAFE;
        if (BreedHeatRisk.isBrachycephalic(pet.breed())) {
            reasons.add(WalkSafetyReason.of(WalkSafetyReasonCode.BRACHYCEPHALIC,
                "%s는 코가 짧은 견종이라 고온에서 체온을 내리기 어렵습니다. 짧게 걷고 자주 쉬어 주세요."
                    .formatted(pet.breed())));
            level = level.worseOf(WalkSafetyLevel.DANGER);
        }
        if (pet.heatSensitive()) {
            reasons.add(WalkSafetyReason.of(WalkSafetyReasonCode.HEAT_SENSITIVE,
                "더위에 약한 아이라 같은 기온에도 부담이 큽니다."));
            level = level.worseOf(WalkSafetyLevel.CAUTION);
        }
        return level;
    }

    private static WalkSafetyLevel assessCold(
        double airTemperature, PetCondition pet, SuitabilityThresholds thresholds, List<WalkSafetyReason> reasons
    ) {
        if (airTemperature > thresholds.coldTemperature()) {
            return WalkSafetyLevel.SAFE;
        }
        WalkSafetyLevel level = airTemperature <= thresholds.veryColdTemperature()
            ? WalkSafetyLevel.CAUTION : WalkSafetyLevel.SAFE;
        reasons.add(WalkSafetyReason.of(WalkSafetyReasonCode.COLD_RISK,
            "기온 %.0f도로 낮아 장시간 산책은 피하는 편이 좋습니다.".formatted(airTemperature)));

        if (pet.coldSensitive()) {
            reasons.add(WalkSafetyReason.of(WalkSafetyReasonCode.COLD_SENSITIVE,
                "추위에 약한 아이라 옷을 입히고 시간을 줄이는 편이 좋습니다."));
            level = level.worseOf(WalkSafetyLevel.CAUTION);
        }
        return level;
    }

    private static WalkSafetyLevel assessSurfaceAndWind(
        WeatherForecast forecast, SuitabilityThresholds thresholds, List<WalkSafetyReason> reasons
    ) {
        WalkSafetyLevel level = WalkSafetyLevel.SAFE;
        if (forecast.isWet()) {
            reasons.add(WalkSafetyReason.of(WalkSafetyReasonCode.WET_SURFACE,
                "노면이 젖어 있어 미끄러짐과 발 세척에 유의해 주세요."));
            level = level.worseOf(WalkSafetyLevel.CAUTION);
        }
        Double wind = forecast.windSpeed();
        if (wind != null && wind >= thresholds.strongWindSpeed()) {
            reasons.add(WalkSafetyReason.of(WalkSafetyReasonCode.WIND_STRONG,
                "풍속 %.0fm/s 로 소형견 산책에 주의가 필요합니다.".formatted(wind)));
            level = level.worseOf(WalkSafetyLevel.CAUTION);
        }
        return level;
    }

    /**
     * 같은 날 안에서 더 안전한 연속 시간대를 찾는다.
     *
     * <p>기준 시각 <b>이후</b>만 본다. 이미 지나간 아침 시간대를 제안하는 것은 조언이 아니다.
     */
    private static Optional<SaferWindow> findSaferWindow(
        List<WeatherForecast> hourly, PetCondition pet, SuitabilityThresholds thresholds, LocalDateTime at
    ) {
        if (hourly == null || hourly.isEmpty()) {
            return Optional.empty();
        }

        List<WeatherForecast> upcoming = hourly.stream()
            .filter(forecast -> forecast.forecastAt().isAfter(at))
            .filter(forecast -> forecast.temperature() != null)
            .sorted(Comparator.comparing(WeatherForecast::forecastAt))
            .toList();

        LocalTime start = null;
        LocalTime end = null;
        for (WeatherForecast forecast : upcoming) {
            WalkSafetyLevel level = quickLevel(forecast, pet, thresholds);
            boolean acceptable = level.getSeverity() <= SAFER_WINDOW_MAX_LEVEL.getSeverity()
                && level != WalkSafetyLevel.UNKNOWN;
            if (acceptable) {
                LocalTime time = forecast.forecastAt().toLocalTime();
                if (start == null) {
                    start = time;
                }
                end = time;
            } else if (start != null) {
                // 연속 구간이 끊겼다. 가장 이른 구간을 제안한다 - 가까운 미래일수록 쓸모 있다.
                break;
            }
        }
        return start == null ? Optional.empty() : Optional.of(new SaferWindow(start, end));
    }

    /**
     * 안전 시간대 탐색용 간이 판정. 근거 문장을 만들지 않아 값이 싸다.
     *
     * <p>전체 판정을 시각마다 돌리면 근거 리스트를 스물네 번 만들게 된다.
     */
    private static WalkSafetyLevel quickLevel(
        WeatherForecast forecast, PetCondition pet, SuitabilityThresholds thresholds
    ) {
        double airTemperature = forecast.temperature();
        PavementHeat pavement = PavementHeat.estimate(
            airTemperature, forecast.skyState(), forecast.isWet(), forecast.forecastAt().getHour());
        HeatIndex heatIndex = HeatIndex.of(airTemperature, forecast.humidity());

        WalkSafetyLevel level = WalkSafetyLevel.SAFE;
        if (pavement.estimatedCelsius() >= thresholds.pavementDangerCelsius()) {
            level = level.worseOf(WalkSafetyLevel.DANGER);
        } else if (pavement.estimatedCelsius() >= thresholds.pavementCautionCelsius()) {
            level = level.worseOf(WalkSafetyLevel.CAUTION);
        }
        if (heatIndex.celsius() >= thresholds.heatIndexDangerCelsius()) {
            level = level.worseOf(WalkSafetyLevel.DANGER);
        } else if (heatIndex.celsius() >= thresholds.heatIndexCautionCelsius()) {
            level = level.worseOf(WalkSafetyLevel.CAUTION);
        }
        if (BreedHeatRisk.isBrachycephalic(pet.breed()) && heatIndex.celsius() >= thresholds.heatIndexCautionCelsius()) {
            level = level.worseOf(WalkSafetyLevel.DANGER);
        }
        if (forecast.isWet()) {
            level = level.worseOf(WalkSafetyLevel.CAUTION);
        }
        return level;
    }

    private record SaferWindow(LocalTime start, LocalTime end) {

    }
}

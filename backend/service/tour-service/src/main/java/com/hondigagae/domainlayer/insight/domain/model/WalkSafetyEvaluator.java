package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
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
     * @param coverage 예보를 못 쓸 때 <b>왜</b> 못 쓰는지. 근거 문장이 여기서 갈린다
     */
    public static WalkSafetyAssessment evaluate(
        WeatherForecast forecast, List<WeatherForecast> hourly, PetCondition pet,
        SuitabilityThresholds thresholds, LocalDateTime at, ForecastCoverage coverage,
        WeatherWarning warning
    ) {
        // 특보 경보는 예보보다 먼저 본다. 시각별 예보가 없어도 태풍경보에 "판단 근거 부족"을
        // 돌려주면 안 된다 - 근거는 있고, 그 근거가 나가지 말라고 말하고 있다.
        if (warning != null && warning.level().isWarning()) {
            return WalkSafetyAssessment.builder()
                .level(WalkSafetyLevel.DANGER)
                .reasons(List.of(WalkSafetyReason.of(WalkSafetyReasonCode.WEATHER_WARNING_ACTIVE,
                    "%s %s 발효 중입니다. %s".formatted(warning.type().getDisplayName(),
                        warning.level().getDisplayName(), warning.type().getDescription()))))
                .build();
        }

        if (forecast == null || forecast.temperature() == null) {
            return WalkSafetyAssessment.unknown(List.of(missingForecastReason(coverage)));
        }

        List<WalkSafetyReason> reasons = new ArrayList<>();
        double airTemperature = forecast.temperature();
        PavementHeat pavement = PavementHeat.estimate(
            airTemperature, forecast.skyState(), forecast.isWet(), at.getHour());
        HeatIndex heatIndex = HeatIndex.of(airTemperature, forecast.humidity());

        WalkSafetyLevel level = WalkSafetyLevel.SAFE;
        level = level.worseOf(assessWeatherWarning(warning, reasons));
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

    /**
     * 예보를 못 쓴 이유. <b>셋을 뭉뚱그리지 않는다.</b>
     *
     * <p>예보 시간대가 지난 것(밤마다 일어나는 정상 상태)에 "3일 이후라 판단하지 않았다"고
     * 답하면 사용자는 오늘 날짜를 미래로 착각하고, 장애라고 답하면 풀리지 않을 것을 계속
     * 다시 시도한다. 상태마다 할 말이 다르다.
     */
    private static WalkSafetyReason missingForecastReason(ForecastCoverage coverage) {
        return switch (coverage == null ? ForecastCoverage.UNAVAILABLE : coverage) {
            case OUT_OF_RANGE -> WalkSafetyReason.of(WalkSafetyReasonCode.FORECAST_OUT_OF_RANGE,
                "노면 온도는 시각별 기온과 일사로 계산합니다. 3일 이후는 오전/오후 단위 예보만 있어 "
                    + "판단하지 않았습니다 — 여행이 가까워지면 다시 확인해 주세요.");
            case DAY_ENDED -> WalkSafetyReason.of(WalkSafetyReasonCode.FORECAST_DAY_ENDED,
                "그 날짜의 예보 시간대가 이미 지났습니다. 기상청은 23시 발표부터 다음 날 예보만 주기 때문에 "
                    + "늦은 밤에는 오늘의 시각별 판단을 하지 않습니다 — 내일 일정으로 확인해 주세요.");
            default -> WalkSafetyReason.of(WalkSafetyReasonCode.FORECAST_UNAVAILABLE,
                "날씨 정보를 가져오지 못해 위험도를 판단하지 못했습니다.");
        };
    }

    /**
     * 주의보를 반영한다. 경보는 이 메서드에 오지 않는다 - 위에서 이미 DANGER 로 끊었다.
     *
     * <p>주의보는 최소 CAUTION 이다. 노면과 열지수가 아무리 좋아도 "안전"이라고 말하지 않는다 -
     * 기상청이 조건이 나빠지고 있다고 알린 상태에서 안전을 단언하면 안 된다.
     */
    private static WalkSafetyLevel assessWeatherWarning(WeatherWarning warning, List<WalkSafetyReason> reasons) {
        if (warning == null) {
            return WalkSafetyLevel.SAFE;
        }
        reasons.add(WalkSafetyReason.of(WalkSafetyReasonCode.WEATHER_WARNING_ACTIVE,
            "%s %s 발효 중입니다. %s".formatted(warning.type().getDisplayName(),
                warning.level().getDisplayName(), warning.type().getDescription())));
        return WalkSafetyLevel.CAUTION;
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
    /**
     * 남은 시간대별 안전 등급 곡선.
     *
     * <p>{@code evaluate} 가 한 시각을 판정하는 것과 달리 <b>하루의 모양</b>을 준다.
     * "지금 나가도 되나"와 "오늘 언제 나가야 하나"는 다른 질문이고, 뒤쪽에는 곡선이 필요하다.
     *
     * <p>안전 시간대 탐색과 <b>같은 간이 판정</b>({@code quickLevel})을 쓴다. 따로 계산하면
     * 같은 시각을 walk-safety 는 주의로, 골든타임은 안전으로 말하는 일이 생긴다.
     *
     * @param from 이 시각 이후만 본다. 지나간 시간을 제안하면 조언이 아니다
     */
    public static List<HourlyWalkSafety> hourlyCurve(
        List<WeatherForecast> hourly, PetCondition pet, SuitabilityThresholds thresholds, LocalDateTime from
    ) {
        if (hourly == null || hourly.isEmpty()) {
            return List.of();
        }
        return hourly.stream()
            .filter(forecast -> !forecast.forecastAt().isBefore(from))
            .filter(forecast -> forecast.temperature() != null)
            .sorted(Comparator.comparing(WeatherForecast::forecastAt))
            .map(forecast -> new HourlyWalkSafety(
                forecast.forecastAt(),
                quickLevel(forecast, pet, thresholds),
                forecast.temperature(),
                PavementHeat.estimate(forecast.temperature(), forecast.skyState(), forecast.isWet(),
                    forecast.forecastAt().getHour()).estimatedCelsius(),
                forecast.precipitationProbability()))
            .toList();
    }

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

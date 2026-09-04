package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.shared.travel.insight.ForecastSource;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.Builder;

/**
 * 하루 단위로 접은 예보. 일정은 날짜 단위로 움직이므로 시각별 예보를 그대로 쓰면
 * 화면과 점수 계산이 매번 같은 집계를 반복하게 된다.
 *
 * <p>대표 하늘상태/강수형태는 <b>최빈값이 아니라 가장 나쁜 값</b>을 취한다. 하루 중 두 시간만
 * 비가 와도 반려견 야외 일정에는 그 두 시간이 문제이기 때문이다.
 *
 * <p><b>단기예보와 중기예보가 같은 타입으로 흐른다.</b> 판정 규칙을 두 벌로 만들지 않기
 * 위해서다. 대신 {@code source} 로 성질을 구분한다 - 중기예보에는 시각별 데이터도, 습도도,
 * 풍속도 없어서 {@code hourly} 가 비고 해당 필드가 null 이다. 그것을 0 으로 채우지 않는다.
 */
@Builder
public record DailyWeather(
    LocalDate date,
    // 어느 예보에서 나온 값인지. 중기예보는 근거가 적어 판정 결과에 그 사실이 드러나야 한다.
    ForecastSource source,
    Double minTemperature,
    Double maxTemperature,
    Integer maxPrecipitationProbability,
    PrecipitationType worstPrecipitationType,
    SkyState representativeSkyState,
    // 중기예보에는 없다. null 이 정상값이다.
    Double maxWindSpeed,
    Integer maxHumidity,
    double totalPrecipitationMm,
    // 중기예보에서는 빈 목록이다. 시각 단위 판정(산책 위험도)이 불가능한 이유가 이것이다.
    List<WeatherForecast> hourly
) {

    /** 미래 날짜를 하루로 접기 위해 필요한 최소 시각 수. 단기예보는 3시간 간격이라 4개면 반나절이다. */
    private static final int MIN_HOURLY_READINGS_FOR_FUTURE_DAY = 4;
    /** 최고기온이 나오는 시간대. 이 이후 예보가 없으면 하루의 최고기온을 놓친다. */
    private static final int AFTERNOON_FROM_HOUR = 12;

    public static List<DailyWeather> foldByDate(List<WeatherForecast> forecasts) {
        Map<LocalDate, List<WeatherForecast>> byDate = forecasts.stream()
            .collect(Collectors.groupingBy(
                forecast -> forecast.forecastAt().toLocalDate(), LinkedHashMap::new, Collectors.toList()));

        return byDate.entrySet().stream()
            .map(entry -> fold(entry.getKey(), entry.getValue()))
            .sorted(Comparator.comparing(DailyWeather::date))
            .toList();
    }

    public static Optional<DailyWeather> findByDate(List<DailyWeather> dailies, LocalDate date) {
        return dailies.stream().filter(daily -> daily.date().equals(date)).findFirst();
    }

    /**
     * 일자별 예보 목록이 그 날짜를 덮는지. 판정 규칙은 {@link ForecastCoverage} 한 곳에 있다.
     *
     * <p>{@code findByDate} 가 비었을 때 <b>왜</b> 비었는지를 답한다.
     */
    public static ForecastCoverage coverageOn(List<DailyWeather> dailies, LocalDate date) {
        if (dailies == null) {
            return ForecastCoverage.UNAVAILABLE;
        }
        return ForecastCoverage.of(date, dailies.stream().map(DailyWeather::date).collect(Collectors.toSet()));
    }

    /** 시각 단위 판정이 가능한 예보인지. 산책 위험도가 이 값을 본다. */
    public boolean supportsHourlyJudgement() {
        return source != null && source.supportsHourlyJudgement() && hourly != null && !hourly.isEmpty();
    }

    /**
     * 하루 대표값을 낼 만큼 예보가 있는지.
     *
     * <p><b>단기예보의 마지막 날은 시각이 거의 없다.</b> 실측하니 5일치 중 마지막 날에
     * 자정 한 시각만 왔다. 그것으로 접으면 "최고기온 = 자정 기온"이 되어, 근거가 거의 없는데도
     * 그럴듯한 점수가 나온다. 조용히 틀리는 쪽이라 값의 유무가 아니라 <b>온전함</b>을 따진다.
     *
     * <p>판정 기준은 낮 데이터의 존재다. 최고기온은 오후에 나오므로 12시 이후 예보가 없으면
     * 하루의 최고기온을 놓친다.
     *
     * <p>세 경우로 갈린다.
     * <ul>
     *   <li>중기예보 — 항상 true. 원천이 최고/최저기온을 직접 주므로 시각별 데이터가 필요 없다</li>
     *   <li>오늘 — 남은 시각이 하나라도 있으면 true. 지나간 시간이 없는 것이 정상이고,
     *       "남은 하루"는 그 자체로 답이 된다</li>
     *   <li>미래 날짜 — 시각이 충분하고 낮 데이터가 있어야 true</li>
     * </ul>
     */
    public boolean hasDaySummary(LocalDate today) {
        if (source == ForecastSource.MID_TERM) {
            return true;
        }
        if (hourly == null || hourly.isEmpty()) {
            return false;
        }
        if (date.equals(today)) {
            return true;
        }
        return hourly.size() >= MIN_HOURLY_READINGS_FOR_FUTURE_DAY && hasAfternoonReading();
    }

    private boolean hasAfternoonReading() {
        return hourly.stream().anyMatch(forecast -> forecast.forecastAt().getHour() >= AFTERNOON_FROM_HOUR);
    }

    private static DailyWeather fold(LocalDate date, List<WeatherForecast> hourly) {
        return DailyWeather.builder()
            .date(date)
            .source(ForecastSource.SHORT_TERM)
            // TMN/TMX 가 오면 그 값을, 없으면 시각별 기온으로 대신한다.
            .minTemperature(lowest(hourly, WeatherForecast::minTemperature)
                .orElseGet(() -> lowest(hourly, WeatherForecast::temperature).orElse(null)))
            .maxTemperature(highest(hourly, WeatherForecast::maxTemperature)
                .orElseGet(() -> highest(hourly, WeatherForecast::temperature).orElse(null)))
            .maxPrecipitationProbability(highest(hourly, WeatherForecast::precipitationProbability).orElse(null))
            .worstPrecipitationType(worstPrecipitationType(hourly))
            .representativeSkyState(worstSkyState(hourly))
            .maxWindSpeed(highest(hourly, WeatherForecast::windSpeed).orElse(null))
            .maxHumidity(highest(hourly, WeatherForecast::humidity).orElse(null))
            .totalPrecipitationMm(hourly.stream()
                .map(WeatherForecast::precipitation)
                .filter(Objects::nonNull)
                .mapToDouble(PrecipitationAmount::millimeters)
                .sum())
            .hourly(hourly)
            .build();
    }

    private static <T extends Comparable<T>> Optional<T> lowest(
        List<WeatherForecast> hourly, Function<WeatherForecast, T> extractor
    ) {
        return hourly.stream().map(extractor).filter(Objects::nonNull).min(Comparator.naturalOrder());
    }

    private static <T extends Comparable<T>> Optional<T> highest(
        List<WeatherForecast> hourly, Function<WeatherForecast, T> extractor
    ) {
        return hourly.stream().map(extractor).filter(Objects::nonNull).max(Comparator.naturalOrder());
    }

    /** 하루 중 가장 젖는 형태를 대표값으로 삼는다. */
    private static PrecipitationType worstPrecipitationType(List<WeatherForecast> hourly) {
        return hourly.stream()
            .map(WeatherForecast::precipitationType)
            .filter(Objects::nonNull)
            .filter(PrecipitationType::isWet)
            .findFirst()
            .orElse(PrecipitationType.NONE);
    }

    /** 흐림 > 구름많음 > 맑음 순으로 나쁜 값을 대표로 삼는다. */
    private static SkyState worstSkyState(List<WeatherForecast> hourly) {
        SkyState worst = SkyState.UNKNOWN;
        for (WeatherForecast forecast : hourly) {
            SkyState state = forecast.skyState();
            if (state == null || state == SkyState.UNKNOWN) {
                continue;
            }
            if (worst == SkyState.UNKNOWN || rank(state) > rank(worst)) {
                worst = state;
            }
        }
        return worst;
    }

    private static int rank(SkyState state) {
        return switch (state) {
            case OVERCAST -> 3;
            case MOSTLY_CLOUDY -> 2;
            case CLEAR -> 1;
            case UNKNOWN -> 0;
        };
    }
}

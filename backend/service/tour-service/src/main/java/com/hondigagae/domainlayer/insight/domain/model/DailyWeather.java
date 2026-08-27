package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
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
 */
@Builder
public record DailyWeather(
    LocalDate date,
    Double minTemperature,
    Double maxTemperature,
    Integer maxPrecipitationProbability,
    PrecipitationType worstPrecipitationType,
    SkyState representativeSkyState,
    Double maxWindSpeed,
    Integer maxHumidity,
    double totalPrecipitationMm,
    List<WeatherForecast> hourly
) {

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

    private static DailyWeather fold(LocalDate date, List<WeatherForecast> hourly) {
        return DailyWeather.builder()
            .date(date)
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

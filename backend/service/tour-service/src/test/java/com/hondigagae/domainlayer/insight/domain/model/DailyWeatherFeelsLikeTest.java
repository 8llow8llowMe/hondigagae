package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.shared.travel.insight.ForecastSource;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 하루 최고 체감온도 (#88).
 *
 * <p>일정 브리핑이 "최고기온 31도" 옆에 큰 숫자로 보여 줄 값이다. 습도가 높은 시각이 최고기온
 * 시각과 다를 수 있으므로 "최고기온 + 최고습도" 가 아니라 <b>시각별 열지수의 최대</b>여야 한다.
 */
class DailyWeatherFeelsLikeTest {

    private static final LocalDate DATE = LocalDate.of(2026, 8, 27);

    @Test
    @DisplayName("습한 시각의 체감온도가 최고기온 시각보다 높으면 그 값이 하루 체감온도다")
    void picksMaxFeelsLikeAcrossHours() {
        DailyWeather day = shortTermDay(List.of(
            reading(12, 30.0d, 60),
            reading(15, 31.0d, 40),   // 최고기온이지만 건조 - 보정이 작다
            reading(18, 29.0d, 85)    // 기온은 낮지만 습해서 체감이 높다
        ));

        Double feelsLike = day.maxFeelsLikeTemperature();

        assertThat(feelsLike).isNotNull();
        // 시각별 계산과 같은 규칙(기상청 여름철 체감온도)으로 낸 값 중 최대여야 한다.
        double expected = List.of(
                FeelsLikeTemperature.of(30.0d, 60).celsius(),
                FeelsLikeTemperature.of(31.0d, 40).celsius(),
                FeelsLikeTemperature.of(29.0d, 85).celsius())
            .stream().mapToDouble(Double::doubleValue).max().orElseThrow();
        assertThat(feelsLike).isEqualTo(Math.round(expected * 10.0d) / 10.0d);
    }

    @Test
    @DisplayName("습도가 없는 시각은 기온 그대로다 - 없는 근거로 보정하지 않는다")
    void fallsBackToTemperatureWhenHumidityMissing() {
        DailyWeather humidityless = shortTermDay(List.of(reading(15, 24.5d, null)));

        assertThat(humidityless.maxFeelsLikeTemperature()).isEqualTo(24.5d);
    }

    @Test
    @DisplayName("중기예보는 시각별 데이터가 없어 null 이다 - 최고기온으로 대신하지 않는다")
    void midTermHasNoFeelsLike() {
        DailyWeather midTerm = DailyWeather.builder()
            .date(DATE.plusDays(7))
            .source(ForecastSource.MID_TERM)
            .minTemperature(25.0d).maxTemperature(33.0d)
            .hourly(List.of())
            .build();

        assertThat(midTerm.maxFeelsLikeTemperature()).isNull();
    }

    @Test
    @DisplayName("기온이 없는 시각은 건너뛰고, 전부 없으면 null 이다")
    void skipsReadingsWithoutTemperature() {
        DailyWeather noTemperature = shortTermDay(List.of(reading(12, null, 70)));

        assertThat(noTemperature.maxFeelsLikeTemperature()).isNull();
    }

    private static WeatherForecast reading(int hour, Double temperature, Integer humidity) {
        return WeatherForecast.builder()
            .nx(53).ny(38)
            .forecastAt(DATE.atTime(hour, 0))
            .baseAt(DATE.atTime(2, 0))
            .temperature(temperature)
            .humidity(humidity)
            .precipitationType(PrecipitationType.NONE)
            .skyState(SkyState.CLEAR)
            .precipitation(PrecipitationAmount.none())
            .build();
    }

    private static DailyWeather shortTermDay(List<WeatherForecast> hourly) {
        return DailyWeather.builder()
            .date(DATE)
            .source(ForecastSource.SHORT_TERM)
            .hourly(hourly)
            .build();
    }
}

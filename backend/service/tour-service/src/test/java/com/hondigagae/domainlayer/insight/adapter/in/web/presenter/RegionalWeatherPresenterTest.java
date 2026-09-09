package com.hondigagae.domainlayer.insight.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.RegionWeatherItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.RegionalWeatherResponse;
import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.enums.JejuRegion;
import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.PrecipitationAmount;
import com.hondigagae.domainlayer.insight.domain.model.RegionWeather;
import com.hondigagae.domainlayer.insight.domain.model.RegionalWeatherComparison;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 권역 비교 응답의 날씨 수치 (#342 후속).
 *
 * <p>홈 권역 카드가 최저·최고기온과 체감온도를 함께 그리려면 이 프레젠터가 도메인의
 * {@link DailyWeather} 값을 <b>가공 없이</b> 옮겨야 한다. 특히 체감온도는 장소 상세의
 * {@code weather.maxFeelsLikeTemperature} 와 같은 규칙(기상청 여름철 체감온도)이어야
 * 두 화면의 숫자가 어긋나지 않는다.
 */
class RegionalWeatherPresenterTest {

    private static final LocalDate DATE = LocalDate.of(2026, 8, 27);

    private final RegionalWeatherPresenter presenter = new RegionalWeatherPresenter(new InsightPresenter());

    @Test
    @DisplayName("최저·최고기온과 하루 최고 체감온도가 도메인 값 그대로 실린다")
    void carriesTemperaturesAndFeelsLike() {
        DailyWeather weather = shortTermDay(24.0d, 31.0d, List.of(
            reading(12, 30.0d, 60),
            reading(15, 31.0d, 40),
            reading(18, 29.0d, 85)   // 기온은 낮지만 습해서 체감이 가장 높은 시각
        ));
        RegionalWeatherComparison comparison = RegionalWeatherComparison.of(
            DATE, List.of(scored(JejuRegion.NORTH, weather)), null);

        RegionalWeatherResponse response = presenter.toResponse(comparison);

        RegionWeatherItem item = response.regions().get(0);
        assertThat(item.minTemperature()).isEqualTo(24.0d);
        assertThat(item.maxTemperature()).isEqualTo(31.0d);
        // 장소 상세와 같은 규칙 - 시각별 체감온도의 최대이지 "최고기온 + 최고습도" 가 아니다.
        assertThat(item.maxFeelsLikeTemperature()).isEqualTo(weather.maxFeelsLikeTemperature());
        assertThat(item.maxFeelsLikeTemperature()).isGreaterThan(item.maxTemperature());
    }

    @Test
    @DisplayName("예보를 못 받은 권역은 수치가 전부 null 로 남는다 - 0 이나 대체값을 지어내지 않는다")
    void leavesUnavailableRegionBlank() {
        RegionWeather unavailable = RegionWeather.builder()
            .region(JejuRegion.HALLA)
            .date(DATE)
            .coverage(ForecastCoverage.UNAVAILABLE)
            .reasons(List.of())
            .build();
        RegionalWeatherComparison comparison = RegionalWeatherComparison.of(
            DATE, List.of(unavailable), null);

        RegionWeatherItem item = presenter.toResponse(comparison).regions().get(0);

        assertThat(item.weatherScore()).isNull();
        assertThat(item.minTemperature()).isNull();
        assertThat(item.maxTemperature()).isNull();
        assertThat(item.maxFeelsLikeTemperature()).isNull();
    }

    private static RegionWeather scored(JejuRegion region, DailyWeather weather) {
        return RegionWeather.builder()
            .region(region)
            .date(DATE)
            .weather(weather)
            .weatherScore(82)
            .coverage(ForecastCoverage.AVAILABLE)
            .reasons(List.of())
            .build();
    }

    private static DailyWeather shortTermDay(
        Double minTemperature, Double maxTemperature, List<WeatherForecast> hourly
    ) {
        return DailyWeather.builder()
            .date(DATE)
            .source(com.hondigagae.shared.travel.insight.ForecastSource.SHORT_TERM)
            .minTemperature(minTemperature)
            .maxTemperature(maxTemperature)
            .hourly(hourly)
            .build();
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
}

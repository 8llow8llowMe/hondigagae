package com.hondigagae.domainlayer.insight.adapter.out.client.kma;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 응답 잘림 방어 검증.
 *
 * <p>실측(2026-08-28, 격자 53:38, 17시 회차)에서 한 회차가 1,052행이었다. numOfRows 를 1,000 으로
 * 두면 마지막 날이 반쪽으로 오는데, <b>오류가 아니라 그럴듯한 값</b>이라 조용히 틀린다 -
 * 21시까지 오던 09-01 이 12시까지만 오면 TMX 가 사라져 최고기온이 31.0 대신 30.0 이 된다.
 * 고온 임계값이 31.0 이라 판정이 정확히 갈리고, 방향이 "실제보다 안전하다"다.
 */
class KmaForecastTruncationTest {

    @Test
    @DisplayName("잘린 응답의 마지막 날짜를 버린다")
    void dropsLastDayWhenTruncated() {
        List<WeatherForecast> forecasts = Stream.concat(
            dayOf(2026, 9, 1, 0, 3, 6, 9, 12, 15, 18, 21).stream(),
            dayOf(2026, 9, 2, 0, 3, 6).stream()
        ).toList();

        List<WeatherForecast> kept = KmaVillageForecastAdapter.dropIncompleteTailDay(forecasts);

        assertThat(kept).hasSize(8);
        assertThat(kept).allSatisfy(forecast ->
            assertThat(forecast.forecastAt().toLocalDate().getDayOfMonth()).isEqualTo(1));
    }

    @Test
    @DisplayName("앞쪽 날짜는 건드리지 않는다")
    void keepsEarlierDaysIntact() {
        // 행이 (fcstDate, fcstTime) 오름차순으로 오므로 잘림은 항상 꼬리만 자른다.
        List<WeatherForecast> forecasts = Stream.of(
            dayOf(2026, 8, 30, 0, 6, 12, 18),
            dayOf(2026, 8, 31, 0, 6, 12, 18),
            dayOf(2026, 9, 1, 0, 6)
        ).flatMap(List::stream).toList();

        List<WeatherForecast> kept = KmaVillageForecastAdapter.dropIncompleteTailDay(forecasts);

        assertThat(kept).hasSize(8);
        assertThat(kept.get(kept.size() - 1).forecastAt().toLocalDate().getDayOfMonth()).isEqualTo(31);
    }

    @Test
    @DisplayName("받은 것이 한 날짜뿐이면 버리지 않는다")
    void keepsSingleDayEvenWhenTruncated() {
        // 반쪽이라도 없는 것보다 낫다. 온전하지 않다는 사실은 hasDaySummary 가 시각 수로 다시 본다.
        List<WeatherForecast> forecasts = dayOf(2026, 9, 1, 0, 3, 6);

        assertThat(KmaVillageForecastAdapter.dropIncompleteTailDay(forecasts)).isEqualTo(forecasts);
    }

    @Test
    @DisplayName("빈 목록은 그대로 둔다")
    void keepsEmptyList() {
        assertThat(KmaVillageForecastAdapter.dropIncompleteTailDay(List.of())).isEmpty();
    }

    private static List<WeatherForecast> dayOf(int year, int month, int day, int... hours) {
        return java.util.Arrays.stream(hours)
            .mapToObj(hour -> WeatherForecast.builder()
                .forecastAt(LocalDateTime.of(year, month, day, hour, 0))
                .temperature(25.0)
                .build())
            .toList();
    }
}

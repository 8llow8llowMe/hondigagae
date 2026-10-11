package com.hondigagae.domainlayer.insight.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.common.geo.KmaGrid;
import com.hondigagae.common.geo.KmaGridPoint;
import com.hondigagae.domainlayer.insight.application.port.out.ForecastRefreshLockPort;
import com.hondigagae.domainlayer.insight.application.port.out.MidTermForecastCachePort;
import com.hondigagae.domainlayer.insight.application.port.out.MidTermForecastPort;
import com.hondigagae.domainlayer.insight.application.port.out.WeatherForecastCachePort;
import com.hondigagae.domainlayer.insight.application.port.out.WeatherObservationPort;
import com.hondigagae.domainlayer.insight.application.port.out.query.CachedMidTermQueryResult;
import com.hondigagae.domainlayer.insight.application.port.out.query.CachedWeatherQueryResult;
import com.hondigagae.domainlayer.insight.domain.enums.MidTermRegion;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import com.hondigagae.global.properties.KmaApiProperties;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * {@link WeatherForecastProcessor#dailyForecastKey} — 장소 추천이 날씨를 메모이즈하는 키 (#1368).
 *
 * <p>키가 {@code dailyForecastsAt} 이 실제로 읽는 (격자, 중기 구역)과 어긋나면 메모가 다른 장소의 날씨를 돌려준다.
 * 조용히 틀리는 종류라 실제 설정(격자 묶기 배수)으로 못박는다.
 */
class WeatherForecastDailyKeyTest {

    private static final double JEJU_LAT = 33.4996d;
    private static final double JEJU_LNG = 126.5312d;

    private final WeatherObservationPort observationPort = mock(WeatherObservationPort.class);
    private final WeatherForecastCachePort forecastCachePort = mock(WeatherForecastCachePort.class);
    private final MidTermForecastPort midTermForecastPort = mock(MidTermForecastPort.class);
    private final MidTermForecastCachePort midTermCachePort = mock(MidTermForecastCachePort.class);
    private final ForecastRefreshLockPort lockPort = mock(ForecastRefreshLockPort.class);

    @Test
    @DisplayName("묶은 격자가 같으면 좌표가 달라도 키가 같다")
    void sameCoarsenedGridSameKey() {
        int factor = 4;
        WeatherForecastProcessor processor = processor(factor);
        double nearbyLat = JEJU_LAT + 0.01d;
        // 전제: 두 좌표가 실제로 같은 묶음 격자에 든다.
        assertThat(KmaGrid.of(nearbyLat, JEJU_LNG).coarsenedBy(factor)).isEqualTo(KmaGrid.of(JEJU_LAT, JEJU_LNG).coarsenedBy(factor));

        assertThat(processor.dailyForecastKey(nearbyLat, JEJU_LNG, "4"))
            .isEqualTo(processor.dailyForecastKey(JEJU_LAT, JEJU_LNG, "4"));
    }

    @Test
    @DisplayName("격자가 같아도 중기예보 구역이 다르면 키가 다르다")
    void differentMidTermRegionDifferentKey() {
        WeatherForecastProcessor processor = processor(1);

        assertThat(processor.dailyForecastKey(JEJU_LAT, JEJU_LNG, "3"))
            .isNotEqualTo(processor.dailyForecastKey(JEJU_LAT, JEJU_LNG, "4"));
    }

    @Test
    @DisplayName("키는 dailyForecastsAt 이 실제로 조회하는 격자와 중기 구역에서 나온다")
    void keyMatchesWhatDailyForecastsAtReads() {
        WeatherForecastProcessor processor = processor(3);
        when(forecastCachePort.find(any())).thenReturn(Optional.of(CachedWeatherQueryResult.builder()
            .forecasts(List.of(WeatherForecast.builder().forecastAt(LocalDateTime.now().withHour(12)).temperature(20.0d).build()))
            .freshUntil(LocalDateTime.now().plusHours(1))
            .stale(false)
            .build()));
        when(midTermCachePort.find(any())).thenReturn(Optional.of(CachedMidTermQueryResult.builder()
            .dailies(List.of())
            .freshUntil(LocalDateTime.now().plusHours(1))
            .stale(false)
            .build()));

        processor.dailyForecastsAt(JEJU_LAT, JEJU_LNG, "3");

        ArgumentCaptor<KmaGridPoint> grid = ArgumentCaptor.forClass(KmaGridPoint.class);
        ArgumentCaptor<MidTermRegion> region = ArgumentCaptor.forClass(MidTermRegion.class);
        verify(forecastCachePort).find(grid.capture());
        verify(midTermCachePort).find(region.capture());
        assertThat(processor.dailyForecastKey(JEJU_LAT, JEJU_LNG, "3"))
            .isEqualTo(grid.getValue().cacheKey() + "|" + region.getValue().cacheKey());
    }

    private WeatherForecastProcessor processor(int gridCoarsenFactor) {
        KmaApiProperties properties = new KmaApiProperties(
            null, null, "test-key", 10, 20, 1000, 21_600, 129_600, 30, 60, gridCoarsenFactor, 10,
            null, false, null, null, null);
        return new WeatherForecastProcessor(
            observationPort, forecastCachePort, midTermForecastPort, midTermCachePort, lockPort, properties);
    }
}

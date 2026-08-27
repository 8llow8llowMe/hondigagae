package com.hondigagae.domainlayer.insight.application.service.processor;

import com.hondigagae.common.geo.KmaGrid;
import com.hondigagae.common.geo.KmaGridPoint;
import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.port.out.WeatherForecastCachePort;
import com.hondigagae.domainlayer.insight.application.port.out.WeatherObservationPort;
import com.hondigagae.domainlayer.insight.application.port.out.query.CachedWeatherQueryResult;
import com.hondigagae.domainlayer.insight.application.port.out.query.WeatherObservationQueryResult;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import com.hondigagae.global.properties.KmaApiProperties;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 격자 단위 예보 조회. 캐시 정책과 폴백 순서를 여기서 <b>결정</b>한다.
 *
 * <p>순서는 external-api-guide §2 를 그대로 따른다.
 * <ol>
 *   <li>신선한 캐시가 있으면 그것</li>
 *   <li>없으면 원천 호출 -> 성공하면 캐시에 넣고 반환</li>
 *   <li>원천이 실패했는데 낡은 캐시라도 있으면 그것 (스테일 허용)</li>
 *   <li>아무것도 없으면 도메인 예외(503)</li>
 * </ol>
 *
 * <p>3번이 이 클래스의 존재 이유다. 기상청이 잠깐 흔들렸다고 장소 상세가 500 을 내면 안 된다.
 * 세 시간 전 예보는 없는 것보다 훨씬 낫다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WeatherForecastProcessor {

    private final WeatherObservationPort weatherObservationPort;
    private final WeatherForecastCachePort weatherForecastCachePort;
    private final KmaApiProperties kmaApiProperties;

    /** 좌표가 속한 격자의 예보 전체(약 3일치)를 시각순으로 준다. */
    public List<WeatherForecast> forecastsAt(double lat, double lng) {
        KmaGridPoint grid = KmaGrid.of(lat, lng);

        Optional<CachedWeatherQueryResult> cached = weatherForecastCachePort.find(grid);
        if (cached.isPresent() && !cached.get().stale()) {
            return cached.get().forecasts();
        }

        try {
            WeatherObservationQueryResult observed = weatherObservationPort.fetchVillageForecast(grid);
            if (!observed.isEmpty()) {
                weatherForecastCachePort.put(grid, observed.forecasts(), observed.nextPublishAt(), retention());
                return observed.forecasts();
            }
            log.warn("KMA returned no forecast rows grid={}", grid.cacheKey());
        } catch (InsightException exception) {
            log.warn("KMA fetch failed, falling back to cache grid={} errorCode={}",
                grid.cacheKey(), exception.getErrorCode().getCode());
        }

        // 원천이 비었거나 실패했다. 낡은 값이라도 있으면 쓴다.
        if (cached.isPresent()) {
            log.info("Serving stale weather cache grid={} freshUntil={}", grid.cacheKey(), cached.get().freshUntil());
            return cached.get().forecasts();
        }
        throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
    }

    /** 날짜 단위로 접은 예보. 일정/적합도는 날짜로 움직이므로 이 형태를 기본으로 쓴다. */
    public List<DailyWeather> dailyForecastsAt(double lat, double lng) {
        return DailyWeather.foldByDate(forecastsAt(lat, lng));
    }

    /**
     * 특정 날짜의 예보. 단기예보 범위(오늘 포함 약 3일) 밖이면 비어 있다.
     *
     * <p><b>비었다는 것은 "날씨가 좋다"가 아니라 "예보가 없다"는 뜻이다.</b> 호출부는 이 구분을
     * 응답에 반드시 드러내야 한다 - 다음 달 여행을 계획하는 사용자에게 근거 없는 점수를 주면 안 된다.
     */
    public Optional<DailyWeather> dailyForecastAt(double lat, double lng, LocalDate date) {
        return DailyWeather.findByDate(dailyForecastsAt(lat, lng), date);
    }

    /** 지금 시각에 가장 가까운 예보 한 건. 현재 상태를 보여줄 때 쓴다. */
    public Optional<WeatherForecast> nearestForecastAt(double lat, double lng, LocalDateTime target) {
        return forecastsAt(lat, lng).stream()
            .min(Comparator.comparingLong(forecast ->
                Math.abs(Duration.between(target, forecast.forecastAt()).toMinutes())));
    }

    /**
     * 캐시 보존 기간. 다음 발표까지가 아니라 그보다 길게 잡는다 -
     * 신선도가 지난 뒤에도 스테일 폴백용으로 남겨 두어야 하기 때문이다.
     */
    private Duration retention() {
        return Duration.ofSeconds(kmaApiProperties.staleCacheSeconds());
    }
}

package com.hondigagae.domainlayer.insight.application.service.processor;

import com.hondigagae.common.geo.KmaGrid;
import com.hondigagae.common.geo.KmaGridPoint;
import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.port.out.MidTermForecastCachePort;
import com.hondigagae.domainlayer.insight.application.port.out.MidTermForecastPort;
import com.hondigagae.domainlayer.insight.application.port.out.WeatherForecastCachePort;
import com.hondigagae.domainlayer.insight.application.port.out.WeatherObservationPort;
import com.hondigagae.domainlayer.insight.application.port.out.query.CachedMidTermQueryResult;
import com.hondigagae.domainlayer.insight.application.port.out.query.CachedWeatherQueryResult;
import com.hondigagae.domainlayer.insight.application.port.out.query.MidTermForecastQueryResult;
import com.hondigagae.domainlayer.insight.application.port.out.query.WeatherObservationQueryResult;
import com.hondigagae.domainlayer.insight.domain.enums.MidTermRegion;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import com.hondigagae.global.properties.KmaApiProperties;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 예보 조회. 캐시 정책과 폴백 순서, 그리고 <b>어느 예보를 쓸지</b>를 여기서 결정한다.
 *
 * <p>폴백 순서는 external-api-guide §2 를 그대로 따른다.
 * <ol>
 *   <li>신선한 캐시가 있으면 그것</li>
 *   <li>없으면 원천 호출 -> 성공하면 캐시에 넣고 반환</li>
 *   <li>원천이 실패했는데 낡은 캐시라도 있으면 그것 (스테일 허용)</li>
 *   <li>아무것도 없으면 도메인 예외(503)</li>
 * </ol>
 * 3번이 이 클래스의 존재 이유다. 기상청이 잠깐 흔들렸다고 장소 상세가 500 을 내면 안 된다.
 *
 * <p><b>단기예보와 중기예보를 합치는 규칙도 여기 한곳에만 둔다.</b> 두 원천은 위치 지정
 * 방식(격자 vs 예보구역)도 시간 해상도(시간 vs 오전/오후)도 다르지만, 호출부가 알아야 할 것은
 * "그 날짜의 날씨"뿐이다. 규칙이 흩어지면 같은 날짜를 화면마다 다른 예보로 답하게 된다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WeatherForecastProcessor {

    private final WeatherObservationPort weatherObservationPort;
    private final WeatherForecastCachePort weatherForecastCachePort;
    private final MidTermForecastPort midTermForecastPort;
    private final MidTermForecastCachePort midTermForecastCachePort;
    private final KmaApiProperties kmaApiProperties;

    /**
     * 좌표가 속한 격자의 단기예보 전체(약 5일치)를 시각순으로 준다.
     *
     * <p>시각 단위가 필요한 산책 위험도 전용이다. 중기예보는 시각별 데이터가 없어 섞이지 않는다.
     */
    public List<WeatherForecast> forecastsAt(double lat, double lng) {
        KmaGridPoint grid = KmaGrid.of(lat, lng);

        Optional<CachedWeatherQueryResult> cached = weatherForecastCachePort.find(grid);
        if (cached.isPresent() && !cached.get().stale()) {
            return cached.get().forecasts();
        }

        try {
            WeatherObservationQueryResult observed = weatherObservationPort.fetchVillageForecast(grid);
            if (!observed.isEmpty()) {
                weatherForecastCachePort.put(grid, observed.forecasts(), observed.nextPublishAt(), shortTermRetention());
                return observed.forecasts();
            }
            log.warn("KMA returned no forecast rows grid={}", grid.cacheKey());
        } catch (InsightException exception) {
            log.warn("KMA fetch failed, falling back to cache grid={} errorCode={}",
                grid.cacheKey(), exception.getErrorCode().getCode());
        }

        if (cached.isPresent()) {
            log.info("Serving stale weather cache grid={} freshUntil={}", grid.cacheKey(), cached.get().freshUntil());
            return cached.get().forecasts();
        }
        throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
    }

    /**
     * 날짜 단위 예보. <b>단기예보와 중기예보를 이어 붙여 약 11일을 덮는다.</b>
     *
     * <p>겹치는 날짜는 <b>단기예보가 온전할 때만</b> 단기예보를 쓴다. 시각별 데이터가 있어
     * 더 정확하고 산책 위험도까지 판정할 수 있지만, <b>마지막 날은 시각이 거의 오지 않는다</b> -
     * 실측에서 5일치 중 마지막 날에 자정 한 시각만 왔다. 그것으로 하루를 접으면
     * "최고기온 = 자정 기온"이 되어 근거가 거의 없는데도 그럴듯한 점수가 나온다.
     * 그 날짜는 최고/최저기온을 원천에서 직접 주는 중기예보가 더 정확하다
     * ({@code DailyWeather.hasDaySummary}).
     *
     * <p>단기예보 조회가 실패해도 중기예보만으로 계속한다. 3일 밖 날짜를 묻는 사용자에게는
     * 단기예보 장애가 아무 상관이 없다 - 그 실패를 이유로 답을 못 주면 안 된다.
     *
     * @param sigunguCode 중기예보 구역을 고르는 데 쓴다. null 이면 위도로 판정한다
     */
    public List<DailyWeather> dailyForecastsAt(double lat, double lng, String sigunguCode) {
        Map<LocalDate, DailyWeather> merged = new LinkedHashMap<>();

        // 중기예보를 먼저 깔고, 온전한 단기예보로 덮는다.
        for (DailyWeather daily : midTermDailies(MidTermRegion.of(sigunguCode, lat))) {
            merged.put(daily.date(), daily);
        }

        LocalDate today = LocalDate.now();
        for (DailyWeather daily : shortTermDailies(lat, lng)) {
            if (daily.hasDaySummary(today)) {
                merged.put(daily.date(), daily);
            } else if (!merged.containsKey(daily.date())) {
                // 중기예보도 없는 날짜라면 부분 데이터라도 없는 것보다 낫다.
                // 대신 그 사실이 응답에 드러난다 - 시각이 적으면 hourly 가 짧게 나간다.
                merged.put(daily.date(), daily);
                log.debug("Using partial short-term day date={} readings={}",
                    daily.date(), daily.hourly().size());
            }
        }

        if (merged.isEmpty()) {
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
        }
        return merged.values().stream()
            .sorted(Comparator.comparing(DailyWeather::date))
            .toList();
    }

    /**
     * 특정 날짜의 예보. 단기·중기 어느 쪽도 닿지 않으면 비어 있다.
     *
     * <p><b>비었다는 것은 "날씨가 좋다"가 아니라 "예보가 없다"는 뜻이다.</b> 호출부는 이 구분을
     * 응답에 반드시 드러내야 한다 - 근거 없는 점수를 주면 안 된다.
     */
    public Optional<DailyWeather> dailyForecastAt(double lat, double lng, String sigunguCode, LocalDate date) {
        return DailyWeather.findByDate(dailyForecastsAt(lat, lng, sigunguCode), date);
    }

    /** 지금 시각에 가장 가까운 예보 한 건. 현재 상태를 보여줄 때 쓴다. */
    public Optional<WeatherForecast> nearestForecastAt(double lat, double lng, LocalDateTime target) {
        return forecastsAt(lat, lng).stream()
            .min(Comparator.comparingLong(forecast ->
                Math.abs(Duration.between(target, forecast.forecastAt()).toMinutes())));
    }

    /** 단기예보를 일자별로 접는다. 실패는 빈 목록이다 - 중기예보만으로도 답할 수 있다. */
    private List<DailyWeather> shortTermDailies(double lat, double lng) {
        try {
            return DailyWeather.foldByDate(forecastsAt(lat, lng));
        } catch (InsightException exception) {
            log.info("Short-term forecast unavailable, continuing with mid-term only errorCode={}",
                exception.getErrorCode().getCode());
            return List.of();
        }
    }

    /**
     * 중기예보를 캐시-원천 순으로 가져온다. 단기예보와 같은 폴백 순서를 쓴다.
     *
     * <p>실패는 빈 목록이다. 오늘 날씨를 묻는 사용자에게 중기예보 장애는 상관이 없다.
     */
    private List<DailyWeather> midTermDailies(MidTermRegion region) {
        Optional<CachedMidTermQueryResult> cached = midTermForecastCachePort.find(region);
        if (cached.isPresent() && !cached.get().stale()) {
            return cached.get().dailies();
        }

        try {
            MidTermForecastQueryResult observed = midTermForecastPort.fetchMidTermForecast(region);
            if (!observed.isEmpty()) {
                midTermForecastCachePort.put(
                    region, observed.dailies(), observed.nextPublishAt(), midTermRetention());
                return observed.dailies();
            }
            log.warn("KMA returned no mid-term rows region={}", region.getDisplayName());
        } catch (InsightException exception) {
            log.warn("Mid-term fetch failed, falling back to cache region={} errorCode={}",
                region.getDisplayName(), exception.getErrorCode().getCode());
        }

        if (cached.isPresent()) {
            log.info("Serving stale mid-term cache region={} freshUntil={}",
                region.getDisplayName(), cached.get().freshUntil());
            return cached.get().dailies();
        }
        return new ArrayList<>();
    }

    /**
     * 캐시 보존 기간. 다음 발표까지가 아니라 그보다 길게 잡는다 -
     * 신선도가 지난 뒤에도 스테일 폴백용으로 남겨 두어야 하기 때문이다.
     */
    private Duration shortTermRetention() {
        return Duration.ofSeconds(kmaApiProperties.staleCacheSeconds());
    }

    /** 중기예보는 발표 간격이 12시간이라 스테일 허용도 길게 잡는다. */
    private Duration midTermRetention() {
        return Duration.ofSeconds(kmaApiProperties.midTermStaleCacheSeconds());
    }
}

package com.hondigagae.domainlayer.insight.application.service.processor;

import com.hondigagae.common.geo.KmaGrid;
import com.hondigagae.common.geo.KmaGridPoint;
import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.port.out.ForecastRefreshLockPort;
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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
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
 *
 * <h2>쿼터 방어</h2>
 *
 * 개발계정 한도가 일 1,000건이라 캐시 적중률이 기능의 가용성을 좌우한다. 세 가지 장치를 둔다.
 *
 * <ul>
 *   <li><b>발표 후 유예</b> - 신선도를 다음 발표 시각이 아니라 그보다 조금 뒤까지로 잡는다.
 *       발표 직후에는 일부 category 가 비어 오는 일이 있어, 어차피 그때 부르면 부실한 값을
 *       받는다. 유예는 그 구간을 피하면서 호출도 아낀다</li>
 *   <li><b>격자 묶기</b> - 기본은 끔. {@code KmaGridPoint.coarsenedBy} 참고</li>
 *   <li><b>갱신 락</b> - 발표 시각이 지나 캐시가 한꺼번에 낡을 때 여러 요청·여러 인스턴스가
 *       같은 격자를 동시에 부르는 것을 막는다</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WeatherForecastProcessor {

    /** 락을 놓쳤고 쓸 캐시도 없을 때, 락 주인이 채워 주기를 기다리는 총 시간. */
    private static final Duration LOCK_WAIT_TIMEOUT = Duration.ofMillis(1_500);
    /** 기다리는 동안 캐시를 다시 확인하는 간격. */
    private static final Duration LOCK_WAIT_POLL = Duration.ofMillis(150);

    private final WeatherObservationPort weatherObservationPort;
    private final WeatherForecastCachePort weatherForecastCachePort;
    private final MidTermForecastPort midTermForecastPort;
    private final MidTermForecastCachePort midTermForecastCachePort;
    private final ForecastRefreshLockPort forecastRefreshLockPort;
    private final KmaApiProperties kmaApiProperties;

    /**
     * 좌표가 속한 격자의 단기예보 전체(약 5일치)를 시각순으로 준다.
     *
     * <p>시각 단위가 필요한 산책 위험도 전용이다. 중기예보는 시각별 데이터가 없어 섞이지 않는다.
     */
    public List<WeatherForecast> forecastsAt(double lat, double lng) {
        KmaGridPoint grid = gridAt(lat, lng);

        List<WeatherForecast> forecasts = loadWithRefreshLock(
            "forecast:" + grid.cacheKey(),
            () -> weatherForecastCachePort.find(grid).map(WeatherForecastProcessor::asView),
            () -> fetchShortTerm(grid));

        if (forecasts.isEmpty()) {
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
        }
        return forecasts;
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

    /** 지금 시각에 가장 가까운 예보 한 건. 현재 상태를 보여줄 때 쓴다. */
    public Optional<WeatherForecast> nearestForecastAt(double lat, double lng, LocalDateTime target) {
        return forecastsAt(lat, lng).stream()
            .min(Comparator.comparingLong(forecast ->
                Math.abs(Duration.between(target, forecast.forecastAt()).toMinutes())));
    }

    /**
     * 조회에 쓸 격자. 설정된 배수만큼 묶는다.
     *
     * <p><b>조회 격자와 캐시 키가 같은 값에서 나와야 한다.</b> 둘이 갈라지면 캐시에 넣은 것과
     * 다른 격자를 조회하게 되어 적중률이 조용히 0 에 가까워진다 - 기능은 정상으로 보이고
     * 쿼터만 타는, 가장 발견하기 어려운 형태의 고장이다. 그래서 여기 한 곳에서만 만든다.
     */
    private KmaGridPoint gridAt(double lat, double lng) {
        return KmaGrid.of(lat, lng).coarsenedBy(kmaApiProperties.gridCoarsenFactor());
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
        return loadWithRefreshLock(
            "midterm:" + region.cacheKey(),
            () -> midTermForecastCachePort.find(region).map(WeatherForecastProcessor::asView),
            () -> fetchMidTerm(region));
    }

    /** 단기예보 원천 호출. 성공하면 캐시에 넣는다. 실패·빈 응답은 빈 목록이다. */
    private List<WeatherForecast> fetchShortTerm(KmaGridPoint grid) {
        try {
            WeatherObservationQueryResult observed = weatherObservationPort.fetchVillageForecast(grid);
            if (!observed.isEmpty()) {
                weatherForecastCachePort.put(
                    grid,
                    observed.forecasts(),
                    withGrace(observed.nextPublishAt(), kmaApiProperties.cacheGraceMinutes()),
                    shortTermRetention());
                return observed.forecasts();
            }
            log.warn("KMA returned no forecast rows grid={}", grid.cacheKey());
        } catch (InsightException exception) {
            log.warn("KMA fetch failed, falling back to cache grid={} errorCode={}",
                grid.cacheKey(), exception.getErrorCode().getCode());
        }
        return List.of();
    }

    /** 중기예보 원천 호출. 성공하면 캐시에 넣는다. 실패·빈 응답은 빈 목록이다. */
    private List<DailyWeather> fetchMidTerm(MidTermRegion region) {
        try {
            MidTermForecastQueryResult observed = midTermForecastPort.fetchMidTermForecast(region);
            if (!observed.isEmpty()) {
                midTermForecastCachePort.put(
                    region,
                    observed.dailies(),
                    withGrace(observed.nextPublishAt(), kmaApiProperties.midTermCacheGraceMinutes()),
                    midTermRetention());
                return observed.dailies();
            }
            log.warn("KMA returned no mid-term rows region={}", region.getDisplayName());
        } catch (InsightException exception) {
            log.warn("Mid-term fetch failed, falling back to cache region={} errorCode={}",
                region.getDisplayName(), exception.getErrorCode().getCode());
        }
        return List.of();
    }

    /**
     * 캐시-락-원천-스테일 순서. 단기예보와 중기예보가 <b>같은 정책</b>을 쓰도록 한 곳에 둔다.
     *
     * <p>락을 못 잡았을 때의 처리가 이 메서드의 핵심이다.
     * <ol>
     *   <li>낡은 캐시라도 있으면 그것을 준다. 락 주인이 곧 새 값을 채우므로 낡음은 잠깐이다</li>
     *   <li>캐시가 아예 없으면(콜드 스타트) 짧게 기다리며 캐시를 다시 본다</li>
     *   <li>그래도 없으면 <b>락 없이 원천을 부른다.</b> 중복 호출 한 건이 사용자에게 에러를
     *       내는 것보다 낫다 - 락은 절약 장치이지 정확성 장치가 아니다</li>
     * </ol>
     *
     * @param originLoader 원천 호출 + 캐시 적재. 실패하면 빈 목록을 준다(예외를 올리지 않는다)
     * @return 값 또는 빈 목록. 비었을 때 예외로 올릴지는 호출부가 정한다
     */
    private <T> List<T> loadWithRefreshLock(
        String lockKey,
        Supplier<Optional<CachedView<T>>> cacheFinder,
        Supplier<List<T>> originLoader
    ) {
        Optional<CachedView<T>> cached = cacheFinder.get();
        if (cached.isPresent() && !cached.get().stale()) {
            return cached.get().values();
        }

        Optional<String> token = forecastRefreshLockPort.tryAcquire(lockKey, refreshLockTtl());
        if (token.isEmpty()) {
            Optional<CachedView<T>> usable = cached.isPresent() ? cached : awaitCache(cacheFinder);
            if (usable.isPresent()) {
                log.debug("Refresh in progress elsewhere, serving cached value lockKey={} freshUntil={}",
                    lockKey, usable.get().freshUntil());
                return usable.get().values();
            }
            log.info("Refresh lock missed with no cache, calling origin unlocked lockKey={}", lockKey);
            return originLoader.get();
        }

        try {
            List<T> loaded = originLoader.get();
            if (!loaded.isEmpty()) {
                return loaded;
            }
        } finally {
            forecastRefreshLockPort.release(lockKey, token.get());
        }

        if (cached.isPresent()) {
            log.info("Serving stale forecast cache lockKey={} freshUntil={}",
                lockKey, cached.get().freshUntil());
            return cached.get().values();
        }
        return List.of();
    }

    /**
     * 락 주인이 캐시를 채워 주기를 짧게 기다린다.
     *
     * <p>콜드 스타트에서만 온다 - 쓸 캐시가 하나라도 있으면 기다리지 않고 그것을 준다.
     * 타임아웃이 짧은 이유는, 기다리다 실패하면 어차피 락 없이 원천을 부르기 때문이다.
     * 오래 기다려 사용자 지연을 늘리는 것보다 중복 호출 한 건이 싸다.
     */
    private <T> Optional<CachedView<T>> awaitCache(Supplier<Optional<CachedView<T>>> cacheFinder) {
        long deadline = System.nanoTime() + LOCK_WAIT_TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            try {
                Thread.sleep(LOCK_WAIT_POLL.toMillis());
            } catch (InterruptedException exception) {
                // 인터럽트 플래그를 되살려 상위(요청 취소 등)가 알 수 있게 하고 기다림을 끝낸다.
                Thread.currentThread().interrupt();
                return Optional.empty();
            }
            Optional<CachedView<T>> cached = cacheFinder.get();
            if (cached.isPresent()) {
                return cached;
            }
        }
        return Optional.empty();
    }

    /**
     * 신선도 만료 시각에 유예를 더한다.
     *
     * <p>발표 시각 정각에 만료시키면 그 순간 모든 격자가 동시에 낡아 호출이 몰리고, 게다가
     * 발표 직후에는 일부 category 가 비어 오는 일이 있어 부실한 값을 받게 된다.
     * 유예는 그 구간을 지나 보내면서 호출도 아낀다.
     */
    private LocalDateTime withGrace(LocalDateTime nextPublishAt, int graceMinutes) {
        if (nextPublishAt == null) {
            return null;
        }
        return nextPublishAt.plusMinutes(graceMinutes);
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

    private Duration refreshLockTtl() {
        return Duration.ofSeconds(kmaApiProperties.refreshLockSeconds());
    }

    private static CachedView<WeatherForecast> asView(CachedWeatherQueryResult cached) {
        return new CachedView<>(cached.forecasts(), cached.freshUntil(), cached.stale());
    }

    private static CachedView<DailyWeather> asView(CachedMidTermQueryResult cached) {
        return new CachedView<>(cached.dailies(), cached.freshUntil(), cached.stale());
    }

    /**
     * 캐시 조회 결과를 한 정책으로 다루기 위한 내부 표현.
     *
     * <p>포트가 돌려주는 두 QueryResult 는 담는 값의 타입만 다르고 신선도 구조는 같다.
     * 여기서 하나로 좁혀 캐시-락-폴백 순서를 한 번만 쓴다.
     */
    private record CachedView<T>(
        List<T> values,
        LocalDateTime freshUntil,
        boolean stale
    ) {

    }
}

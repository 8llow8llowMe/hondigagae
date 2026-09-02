package com.hondigagae.domainlayer.insight.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 예보 캐시 정책 검증 — 캐시-락-원천-스테일 순서와 쿼터 지렛대.
 *
 * <p>여기서 확인하는 것은 날씨 계산이 아니라 <b>기상청을 몇 번 부르는지</b>다. 개발계정 한도가
 * 일 1,000건이라 호출 횟수가 곧 기능의 가용성이고, 이 정책이 조용히 깨지면 기능은 정상으로
 * 보이는 채로 쿼터만 태운다.
 *
 * <p>Mockito 대신 손으로 만든 fake 를 쓴다. 검증 대상이 "호출 횟수와 순서"라서 호출 기록을
 * 직접 세는 편이 stub 체인보다 읽기 쉽다.
 */
class WeatherForecastCachePolicyTest {

    private static final double JEJU_LAT = 33.4996;
    private static final double JEJU_LNG = 126.5312;
    private static final LocalDateTime NEXT_PUBLISH = LocalDateTime.of(2026, 8, 27, 14, 10);

    @Test
    @DisplayName("신선한 캐시가 있으면 기상청을 부르지 않는다")
    void doesNotCallOriginWhenCacheIsFresh() {
        FakeCache cache = new FakeCache(cached(false));
        FakeObservation origin = new FakeObservation();
        WeatherForecastProcessor processor = processor(cache, origin, new FakeLock(true), properties(1));

        List<WeatherForecast> forecasts = processor.forecastsAt(JEJU_LAT, JEJU_LNG);

        assertThat(forecasts).hasSize(1);
        assertThat(origin.calls).isZero();
    }

    @Test
    @DisplayName("캐시가 낡았고 락을 잡으면 기상청을 부르고 락을 해제한다")
    void callsOriginAndReleasesLockWhenAcquired() {
        FakeCache cache = new FakeCache(cached(true));
        FakeObservation origin = new FakeObservation();
        FakeLock lock = new FakeLock(true);
        WeatherForecastProcessor processor = processor(cache, origin, lock, properties(1));

        processor.forecastsAt(JEJU_LAT, JEJU_LNG);

        assertThat(origin.calls).isEqualTo(1);
        assertThat(lock.acquired).isEqualTo(1);
        assertThat(lock.released).isEqualTo(1);
    }

    @Test
    @DisplayName("락을 놓쳤고 낡은 캐시가 있으면 그것을 주고 기상청을 부르지 않는다")
    void servesStaleInsteadOfDuplicatingOriginCall() {
        // 캐시 스탬피드 방어의 핵심. 발표 직후 요청이 몰려도 원천 호출은 락 주인의 것 하나뿐이다.
        FakeCache cache = new FakeCache(cached(true));
        FakeObservation origin = new FakeObservation();
        WeatherForecastProcessor processor = processor(cache, origin, new FakeLock(false), properties(1));

        List<WeatherForecast> forecasts = processor.forecastsAt(JEJU_LAT, JEJU_LNG);

        assertThat(forecasts).hasSize(1);
        assertThat(origin.calls).isZero();
    }

    @Test
    @DisplayName("락을 놓쳤고 캐시도 없으면 기다린 뒤 락 없이 기상청을 부른다")
    void fallsBackToUnlockedCallOnColdStart() {
        // 락은 절약 장치이지 정확성 장치가 아니다. 못 잡았다고 사용자에게 에러를 내면 안 된다.
        FakeCache cache = new FakeCache(null);
        FakeObservation origin = new FakeObservation();
        WeatherForecastProcessor processor = processor(cache, origin, new FakeLock(false), properties(1));

        List<WeatherForecast> forecasts = processor.forecastsAt(JEJU_LAT, JEJU_LNG);

        assertThat(forecasts).hasSize(1);
        assertThat(origin.calls).isEqualTo(1);
    }

    @Test
    @DisplayName("기상청이 실패하면 낡은 캐시라도 준다")
    void servesStaleWhenOriginFails() {
        FakeCache cache = new FakeCache(cached(true));
        FakeObservation origin = new FakeObservation();
        origin.failing = true;
        WeatherForecastProcessor processor = processor(cache, origin, new FakeLock(true), properties(1));

        assertThat(processor.forecastsAt(JEJU_LAT, JEJU_LNG)).hasSize(1);
    }

    @Test
    @DisplayName("기상청이 실패하고 캐시도 없으면 503 으로 올린다")
    void failsWhenNeitherOriginNorCacheIsAvailable() {
        FakeCache cache = new FakeCache(null);
        FakeObservation origin = new FakeObservation();
        origin.failing = true;
        WeatherForecastProcessor processor = processor(cache, origin, new FakeLock(true), properties(1));

        assertThatThrownBy(() -> processor.forecastsAt(JEJU_LAT, JEJU_LNG))
            .isInstanceOf(InsightException.class)
            .hasFieldOrPropertyWithValue("errorCode", InsightErrorCode.WEATHER_UNAVAILABLE);
    }

    @Test
    @DisplayName("캐시 신선도에 발표 후 유예를 더한다")
    void appliesPublishGraceToFreshness() {
        FakeCache cache = new FakeCache(null);
        FakeObservation origin = new FakeObservation();
        WeatherForecastProcessor processor = processor(cache, origin, new FakeLock(true), properties(1));

        processor.forecastsAt(JEJU_LAT, JEJU_LNG);

        // properties(1) 의 유예는 30분이다. 발표 정각에 만료시키면 그 순간 모든 격자가
        // 동시에 낡아 호출이 몰린다.
        assertThat(cache.storedFreshUntil).isEqualTo(NEXT_PUBLISH.plusMinutes(30));
    }

    @Test
    @DisplayName("격자를 묶으면 조회 격자와 캐시 키가 같은 값을 쓴다")
    void usesSameCoarsenedGridForQueryAndCacheKey() {
        // 둘이 갈라지면 캐시에 넣은 것과 다른 격자를 조회하게 되어, 기능은 정상으로 보이는 채로
        // 적중률만 0 에 가까워진다. 가장 발견하기 어려운 형태의 고장이다.
        FakeCache cache = new FakeCache(null);
        FakeObservation origin = new FakeObservation();
        WeatherForecastProcessor processor = processor(cache, origin, new FakeLock(true), properties(2));

        processor.forecastsAt(JEJU_LAT, JEJU_LNG);

        KmaGridPoint expected = KmaGrid.of(JEJU_LAT, JEJU_LNG).coarsenedBy(2);
        assertThat(origin.requestedGrid).isEqualTo(expected);
        assertThat(cache.lookedUpGrid).isEqualTo(expected);
        assertThat(cache.storedGrid).isEqualTo(expected);
    }

    private WeatherForecastProcessor processor(
        FakeCache cache, FakeObservation origin, FakeLock lock, KmaApiProperties properties) {
        return new WeatherForecastProcessor(
            origin, cache, new FakeMidTermPort(), new FakeMidTermCache(), lock, properties);
    }

    /** @param gridCoarsenFactor 1 이면 격자를 묶지 않는다 */
    private KmaApiProperties properties(int gridCoarsenFactor) {
        // 특보 설정은 이 테스트의 관심사가 아니라 비워 둔다(생성자가 기본값을 채운다).
        return new KmaApiProperties(
            null, null, "test-key", 10, 20, 1000, 21_600, 129_600, 30, 60, gridCoarsenFactor, 10,
            null, false, null, null, null);
    }

    private CachedWeatherQueryResult cached(boolean stale) {
        return CachedWeatherQueryResult.builder()
            .forecasts(List.of(forecast()))
            .freshUntil(NEXT_PUBLISH)
            .stale(stale)
            .build();
    }

    private static WeatherForecast forecast() {
        return WeatherForecast.builder()
            .forecastAt(LocalDateTime.of(2026, 8, 27, 12, 0))
            .temperature(28.0)
            .build();
    }

    private static final class FakeCache implements WeatherForecastCachePort {

        private final CachedWeatherQueryResult stored;
        private KmaGridPoint lookedUpGrid;
        private KmaGridPoint storedGrid;
        private LocalDateTime storedFreshUntil;

        private FakeCache(CachedWeatherQueryResult stored) {
            this.stored = stored;
        }

        @Override
        public Optional<CachedWeatherQueryResult> find(KmaGridPoint grid) {
            lookedUpGrid = grid;
            return Optional.ofNullable(stored);
        }

        @Override
        public void put(KmaGridPoint grid, List<WeatherForecast> forecasts,
            LocalDateTime freshUntil, Duration retention) {
            storedGrid = grid;
            storedFreshUntil = freshUntil;
        }
    }

    private static final class FakeObservation implements WeatherObservationPort {

        private int calls;
        private boolean failing;
        private KmaGridPoint requestedGrid;

        @Override
        public WeatherObservationQueryResult fetchVillageForecast(KmaGridPoint grid) {
            calls++;
            requestedGrid = grid;
            if (failing) {
                throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
            }
            return WeatherObservationQueryResult.builder()
                .forecasts(List.of(forecast()))
                .nextPublishAt(NEXT_PUBLISH)
                .build();
        }
    }

    private static final class FakeLock implements ForecastRefreshLockPort {

        private final boolean grants;
        private int acquired;
        private int released;

        private FakeLock(boolean grants) {
            this.grants = grants;
        }

        @Override
        public Optional<String> tryAcquire(String key, Duration ttl) {
            if (!grants) {
                return Optional.empty();
            }
            acquired++;
            return Optional.of("token");
        }

        @Override
        public void release(String key, String token) {
            released++;
        }
    }

    /** 날짜 병합 경로가 아닌 단기예보 경로만 검증하므로 중기예보는 항상 비어 있게 둔다. */
    private static final class FakeMidTermPort implements MidTermForecastPort {

        @Override
        public MidTermForecastQueryResult fetchMidTermForecast(MidTermRegion region) {
            return MidTermForecastQueryResult.builder()
                .dailies(new ArrayList<>())
                .nextPublishAt(NEXT_PUBLISH)
                .build();
        }
    }

    private static final class FakeMidTermCache implements MidTermForecastCachePort {

        @Override
        public Optional<CachedMidTermQueryResult> find(MidTermRegion region) {
            return Optional.empty();
        }

        @Override
        public void put(MidTermRegion region, List<DailyWeather> dailies,
            LocalDateTime freshUntil, Duration retention) {
        }
    }
}

package com.hondigagae.domainlayer.insight.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapperImpl;
import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.enums.JejuRegion;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import com.hondigagae.domainlayer.insight.domain.model.RegionWeather;
import com.hondigagae.domainlayer.insight.domain.model.RegionalWeatherComparison;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.global.properties.InsightProperties;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 권역 비교의 병렬 조회 검증.
 *
 * <p>병렬화로 얻는 것은 속도지만, 잃기 쉬운 것이 둘이다. 이 테스트는 그 둘을 지킨다.
 *
 * <ul>
 *   <li><b>순서</b> — 완료 순서로 모으면 비교표 줄 순서가 매번 달라진다. 사용자가 같은 화면을
 *       두 번 볼 때 다른 것으로 읽고, 동점 추천의 타이브레이크도 흔들린다</li>
 *   <li><b>실패 격리</b> — 한 권역이 실패해도 나머지로 답해야 한다. 병렬에서는 실패가
 *       다른 작업으로 번지기 쉽다</li>
 * </ul>
 */
class RegionalWeatherProcessorTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Test
    @DisplayName("다섯 권역이 실제로 동시에 조회된다")
    void looksUpRegionsConcurrently() throws Exception {
        // 다섯이 모두 래치에 도달해야 통과한다. 순차라면 첫 권역에서 영원히 막힌다.
        CountDownLatch allStarted = new CountDownLatch(JejuRegion.values().length);
        Set<String> threads = ConcurrentHashMap.newKeySet();

        RegionalWeatherProcessor processor = processor(region -> {
            threads.add(Thread.currentThread().getName());
            allStarted.countDown();
            await(allStarted);
            return sunnyForecasts();
        });

        RegionalWeatherComparison comparison = processor.compare(TODAY, PetCondition.unspecified());

        assertThat(allStarted.getCount()).isZero();
        assertThat(threads).hasSizeGreaterThan(1);
        assertThat(comparison.regions()).hasSize(JejuRegion.values().length);
    }

    @Test
    @DisplayName("완료 순서와 무관하게 권역 선언 순서로 모은다")
    void keepsDeclarationOrder() {
        // 뒤 권역일수록 빨리 끝나게 해 완료 순서를 일부러 뒤집는다.
        RegionalWeatherProcessor processor = processor(region -> {
            sleep((JejuRegion.values().length - region.ordinal()) * 20L);
            return sunnyForecasts();
        });

        List<RegionWeather> regions = processor.compare(TODAY, PetCondition.unspecified()).regions();

        assertThat(regions).extracting(RegionWeather::region)
            .containsExactly(JejuRegion.values());
    }

    @Test
    @DisplayName("한 권역이 실패해도 나머지로 답한다")
    void isolatesFailureToOneRegion() {
        RegionalWeatherProcessor processor = processor(region -> {
            if (region == JejuRegion.HALLA) {
                throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
            }
            return sunnyForecasts();
        });

        List<RegionWeather> regions = processor.compare(TODAY, PetCondition.unspecified()).regions();

        // 실패한 권역도 목록에서 지우지 않는다 - 조회되지 않았다는 사실이 드러나야 한다.
        assertThat(regions).hasSize(JejuRegion.values().length);
        assertThat(regions).filteredOn(region -> region.region() == JejuRegion.HALLA)
            .singleElement().satisfies(region -> assertThat(region.isScored()).isFalse());
        assertThat(regions).filteredOn(RegionWeather::isScored).hasSize(JejuRegion.values().length - 1);
    }

    @Test
    @DisplayName("모든 권역이 실패하면 비교 자체를 실패시킨다")
    void failsWhenEveryRegionIsUnavailable() {
        // 빈 비교표를 주면 "전부 비슷하다"로 읽힌다.
        RegionalWeatherProcessor processor = processor(region -> {
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
        });

        assertThatThrownBy(() -> processor.compare(TODAY, PetCondition.unspecified()))
            .isInstanceOf(InsightException.class);
    }

    @Test
    @DisplayName("밤에 다섯 권역이 모두 비어도 실패시키지 않는다")
    void doesNotFailWhenEveryRegionOnlyHasTomorrow() {
        // 기상청 23시 회차는 자기 발표일 행을 주지 않는다. 오늘을 물으면 다섯 권역이 모두
        // 비는데, 그것은 장애가 아니라 밤마다 일어나는 정상 상태다. 5xx 로 올리면 비교 API 가
        // 매일 밤 죽는 것처럼 보인다.
        RegionalWeatherProcessor processor = processor(region -> tomorrowOnlyForecasts());

        RegionalWeatherComparison comparison = processor.compare(TODAY, PetCondition.unspecified());

        assertThat(comparison.regions()).hasSize(JejuRegion.values().length);
        assertThat(comparison.regions()).noneMatch(RegionWeather::isScored);
        assertThat(comparison.regions()).noneMatch(RegionWeather::isFailure);
        assertThat(comparison.regions()).extracting(RegionWeather::coverage)
            .containsOnly(ForecastCoverage.DAY_ENDED);
        // 추천은 없다 - 근거 없이 한 곳을 지목하지 않는다.
        assertThat(comparison.recommended()).isNull();
    }

    // --- fixtures ---

    /** 권역별 예보 조회를 대신하는 훅. */
    private interface ForecastStub {

        List<WeatherForecast> forecastsFor(JejuRegion region);
    }

    /**
     * 좌표로 권역을 되짚어 스텁에 넘긴다.
     *
     * <p>{@code WeatherForecastProcessor} 는 좌표만 받으므로, 어느 권역의 호출인지 알려면
     * 대표 좌표로 되찾아야 한다.
     */
    private RegionalWeatherProcessor processor(ForecastStub stub) {
        WeatherForecastProcessor forecastProcessor = new WeatherForecastProcessor(null, null, null, null, null, null) {

            @Override
            public List<WeatherForecast> forecastsAt(double lat, double lng) {
                return stub.forecastsFor(regionOf(lat, lng));
            }
        };

        return new RegionalWeatherProcessor(
            forecastProcessor, mapper(), properties(), warningProcessor(), executor());
    }

    private JejuRegion regionOf(double lat, double lng) {
        for (JejuRegion region : JejuRegion.values()) {
            if (region.getLat() == lat && region.getLng() == lng) {
                return region;
            }
        }
        throw new IllegalStateException("권역 좌표가 아닙니다: " + lat + ", " + lng);
    }

    /** 특보는 이 테스트의 관심사가 아니라 항상 없음으로 둔다. */
    private WeatherWarningProcessor warningProcessor() {
        return new WeatherWarningProcessor(null, null, null) {

            @Override
            public Optional<WeatherWarning> heaviestWarning() {
                return Optional.empty();
            }
        };
    }

    private Executor executor() {
        return Executors.newFixedThreadPool(JejuRegion.values().length);
    }

    /** 매퍼는 스텁하지 않고 MapStruct 가 만든 실물을 쓴다 - 임계값 변환도 함께 검증된다. */
    private InsightMapper mapper() {
        return new InsightMapperImpl();
    }

    /** 전부 null 로 넘기면 record 생성자가 기본 임계값을 채운다. */
    private InsightProperties properties() {
        return new InsightProperties(null, null, null, null, null, null, null, null, null, null, null, null);
    }

    /** 23시 회차를 받은 뒤의 모습. 오늘 행이 하나도 없다. */
    private static List<WeatherForecast> tomorrowOnlyForecasts() {
        return List.of(WeatherForecast.builder()
            .forecastAt(TODAY.plusDays(1).atTime(9, 0))
            .temperature(21.0d).humidity(50).skyState(SkyState.CLEAR)
            .precipitationProbability(10)
            .build());
    }

    private static List<WeatherForecast> sunnyForecasts() {
        return List.of(WeatherForecast.builder()
            .forecastAt(TODAY.atTime(14, 0))
            .temperature(23.0d).humidity(50).skyState(SkyState.CLEAR)
            .precipitationProbability(10)
            .build());
    }

    private static void await(CountDownLatch latch) {
        try {
            // 순차 실행이면 여기서 못 빠져나온다. 무한 대기 대신 짧게 끊어 테스트를 실패시킨다.
            if (!latch.await(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("권역 조회가 동시에 시작되지 않았습니다");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}

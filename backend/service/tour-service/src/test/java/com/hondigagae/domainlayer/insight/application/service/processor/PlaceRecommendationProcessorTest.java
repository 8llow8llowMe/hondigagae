package com.hondigagae.domainlayer.insight.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.info.PlaceRecommendationInfo;
import com.hondigagae.domainlayer.insight.application.info.RecommendedPlaceInfo;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapperImpl;
import com.hondigagae.domainlayer.insight.application.model.PlaceRecommendationQuery;
import com.hondigagae.domainlayer.insight.application.port.out.CongestionForecastPort;
import com.hondigagae.domainlayer.insight.application.port.out.PlaceProfileQueryPort;
import com.hondigagae.domainlayer.insight.application.port.out.PlaceRecommendationCachePort;
import com.hondigagae.domainlayer.insight.application.port.out.query.CachedPlaceRecommendationQueryResult;
import com.hondigagae.domainlayer.insight.application.service.processor.PlaceRecommendationProcessor.ScoredCandidate;
import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningLevel;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningType;
import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import com.hondigagae.domainlayer.insight.domain.model.PlaceCondition;
import com.hondigagae.domainlayer.insight.domain.model.RecommendationCandidate;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityScore;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.global.properties.InsightProperties;
import com.hondigagae.shared.travel.insight.ForecastSource;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 장소 추천 (#1368).
 *
 * <p>점수 계산은 실제 {@link PlaceSuitabilityProcessor#score} 를 탄다 — 추천 점수와 적합도 한 곳 판정이 같은 규칙을 쓰는지가
 * 이 기능의 전제라, 그 경로를 목으로 바꾸면 전제를 시험하지 못한다. 포트(DB · 캐시 · 기상청)만 목이다.
 */
class PlaceRecommendationProcessorTest {

    private static final String TOURIST_SPOT = "12";
    private static final String CULTURE = "14";
    private static final String LEPORTS = "28";

    private final PlaceProfileQueryPort placeProfileQueryPort = mock(PlaceProfileQueryPort.class);
    private final CongestionForecastPort congestionForecastPort = mock(CongestionForecastPort.class);
    private final PlaceRecommendationCachePort cachePort = mock(PlaceRecommendationCachePort.class);
    private final WeatherForecastProcessor weatherForecastProcessor = mock(WeatherForecastProcessor.class);
    private final WeatherWarningProcessor weatherWarningProcessor = mock(WeatherWarningProcessor.class);
    private final InsightMapper insightMapper = new InsightMapperImpl();
    private final InsightProperties insightProperties =
        new InsightProperties(null, null, null, null, null, null, null, null, null, null, null, null, null);
    private final PlaceSuitabilityProcessor placeSuitabilityProcessor = new PlaceSuitabilityProcessor(
        placeProfileQueryPort, congestionForecastPort, weatherForecastProcessor, insightMapper, insightProperties, weatherWarningProcessor);
    private final PlaceRecommendationProcessor processor = new PlaceRecommendationProcessor(
        placeProfileQueryPort, congestionForecastPort, cachePort, weatherForecastProcessor, weatherWarningProcessor,
        placeSuitabilityProcessor, insightMapper, insightProperties);

    private final LocalDate today = LocalDate.now();

    @BeforeEach
    void setUp() {
        when(cachePort.find(any())).thenReturn(Optional.empty());
        when(weatherWarningProcessor.heaviestWarning()).thenReturn(Optional.empty());
        // 격자 키는 위도로 가른다 — 같은 위도의 후보는 같은 격자다.
        when(weatherForecastProcessor.dailyForecastKey(anyDouble(), anyDouble(), any()))
            .thenAnswer(invocation -> "grid-" + invocation.getArgument(0));
        // 연결된 혼잡도 예측은 없다(UNKNOWN). 요청한 아이디 전부가 키로 온다는 포트 계약을 흉내 낸다.
        when(congestionForecastPort.findByPlacesAndDate(anyCollection(), any())).thenAnswer(invocation -> {
            Collection<Long> ids = invocation.getArgument(0);
            Map<Long, CongestionSnapshot> snapshots = new HashMap<>();
            ids.forEach(id -> snapshots.put(id, CongestionSnapshot.unknown(invocation.getArgument(1))));
            return snapshots;
        });
    }

    @Test
    @DisplayName("후보 조회는 설정의 지역 · 유형으로 한 번, 혼잡도는 후보 전부를 한 번에 묻는다")
    void queriesCandidatesAndCongestionOnce() {
        givenCandidates(candidate(1L, TOURIST_SPOT, 33.40d), candidate(2L, CULTURE, 33.40d), candidate(3L, LEPORTS, 33.50d));
        givenWeather(33.40d, mild(today));
        givenWeather(33.50d, mild(today));

        processor.recommend(query(today, 3));

        verify(placeProfileQueryPort).findRecommendationCandidates("39", List.of("12", "14", "28"));
        verify(congestionForecastPort).findByPlacesAndDate(List.of(1L, 2L, 3L), today);
    }

    @Test
    @DisplayName("같은 격자의 후보가 여럿이어도 날씨는 격자마다 한 번만 부른다")
    void memoizesWeatherPerGrid() {
        givenCandidates(
            candidate(1L, TOURIST_SPOT, 33.40d), candidate(2L, CULTURE, 33.40d),
            candidate(3L, LEPORTS, 33.40d), candidate(4L, TOURIST_SPOT, 33.50d));
        givenWeather(33.40d, mild(today));
        givenWeather(33.50d, mild(today));

        processor.recommend(query(today, 3));

        verify(weatherForecastProcessor, times(1)).dailyForecastsAt(eq(33.40d), anyDouble(), any());
        verify(weatherForecastProcessor, times(1)).dailyForecastsAt(eq(33.50d), anyDouble(), any());
    }

    @Test
    @DisplayName("한 격자의 날씨가 실패하면 그 격자의 장소만 빠지고 나머지는 추천된다 — 실패한 격자도 다시 부르지 않는다")
    void oneGridFailureDropsOnlyItsPlaces() {
        givenCandidates(candidate(1L, TOURIST_SPOT, 33.40d), candidate(2L, CULTURE, 33.40d), candidate(3L, LEPORTS, 33.50d));
        when(weatherForecastProcessor.dailyForecastsAt(eq(33.40d), anyDouble(), any()))
            .thenThrow(new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE));
        givenWeather(33.50d, mild(today));

        PlaceRecommendationInfo info = processor.recommend(query(today, 3));

        assertThat(info.places()).extracting(RecommendedPlaceInfo::placeId).containsExactly(3L);
        verify(weatherForecastProcessor, times(1)).dailyForecastsAt(eq(33.40d), anyDouble(), any());
    }

    @Test
    @DisplayName("날씨 설정 오류(서비스 키 없음)는 삼키지 않는다 — 적합도 한 곳 판정과 같다")
    void configurationFaultPropagates() {
        givenCandidates(candidate(1L, TOURIST_SPOT, 33.40d));
        when(weatherForecastProcessor.dailyForecastsAt(anyDouble(), anyDouble(), any()))
            .thenThrow(new InsightException(InsightErrorCode.WEATHER_SERVICE_KEY_MISSING));

        assertThatThrownBy(() -> processor.recommend(query(today, 3)))
            .isInstanceOf(InsightException.class);
    }

    @Test
    @DisplayName("예보가 닿지 않는 날짜면 점수를 낸 곳이 없어 빈 목록이다")
    void outOfRangeDateYieldsEmpty() {
        LocalDate farFuture = today.plusDays(30);
        givenCandidates(candidate(1L, TOURIST_SPOT, 33.40d));
        givenWeather(33.40d, mild(today));

        PlaceRecommendationInfo info = processor.recommend(query(farFuture, 3));

        assertThat(info.places()).isEmpty();
        assertThat(info.targetDate()).isEqualTo(farFuture);
    }

    @Test
    @DisplayName("후보가 없으면 혼잡도 · 날씨를 부르지 않고 빈 목록을 준다")
    void noCandidatesYieldsEmpty() {
        givenCandidates();

        PlaceRecommendationInfo info = processor.recommend(query(today, 3));

        assertThat(info.places()).isEmpty();
        verifyNoInteractions(congestionForecastPort);
        verify(weatherForecastProcessor, never()).dailyForecastsAt(anyDouble(), anyDouble(), any());
    }

    @Test
    @DisplayName("점수 높은 순으로 고르고, 판정 결과는 적합도와 같은 headline 규칙을 쓴다")
    void ranksByScore() {
        givenCandidates(
            candidate(1L, TOURIST_SPOT, 33.40d),
            candidate(2L, CULTURE, 33.50d),
            candidate(3L, LEPORTS, 33.60d));
        givenWeather(33.40d, hot(today));
        givenWeather(33.50d, mild(today));
        givenWeather(33.60d, mild(today));

        PlaceRecommendationInfo info = processor.recommend(query(today, 3));

        assertThat(info.places()).extracting(RecommendedPlaceInfo::placeId).containsExactly(2L, 3L, 1L);
        RecommendedPlaceInfo first = info.places().get(0);
        assertThat(first.score().score()).isGreaterThan(info.places().get(2).score().score());
        assertThat(first.headline()).isEqualTo("오늘 가기 좋아요");
        assertThat(first.contentTypeId()).isEqualTo(CULTURE);
        assertThat(first.firstImage()).isEqualTo("https://img/2.jpg");
        assertThat(first.weather()).isNotNull();
    }

    @Test
    @DisplayName("실내 대체지는 최종 선정된 곳에만 조회한다 — 전 후보에 돌리지 않는다")
    void looksUpIndoorAlternativesOnlyForSelected() {
        givenCandidates(
            candidate(1L, TOURIST_SPOT, 33.40d), candidate(2L, CULTURE, 33.40d),
            candidate(3L, LEPORTS, 33.40d), candidate(4L, TOURIST_SPOT, 33.40d));
        givenWeather(33.40d, rainy(today));
        when(placeProfileQueryPort.findIndoorAlternatives(any())).thenReturn(List.of());

        PlaceRecommendationInfo info = processor.recommend(query(today, 2));

        assertThat(info.places()).hasSize(2);
        verify(placeProfileQueryPort, times(2)).findIndoorAlternatives(any());
    }

    @Test
    @DisplayName("캐시에 있으면 계산하지 않고 그대로 돌려준다")
    void cacheHitSkipsComputation() {
        CachedPlaceRecommendationQueryResult cached = new CachedPlaceRecommendationQueryResult(today, null, List.of());
        when(cachePort.find(argThat(key -> key.targetDate().equals(today) && key.limit() == 3))).thenReturn(Optional.of(cached));

        PlaceRecommendationInfo info = processor.recommend(query(today, 3));

        assertThat(info.targetDate()).isEqualTo(today);
        assertThat(info.places()).isEmpty();
        verifyNoInteractions(placeProfileQueryPort, congestionForecastPort);
        verify(weatherForecastProcessor, never()).dailyForecastsAt(anyDouble(), anyDouble(), any());
        verify(cachePort, never()).put(any(), any(), any());
    }

    @Test
    @DisplayName("계산한 결과는 설정 TTL 로 캐시에 넣는다")
    void cachesComputedResult() {
        givenCandidates(candidate(1L, TOURIST_SPOT, 33.40d));
        givenWeather(33.40d, mild(today));

        processor.recommend(query(today, 3));

        verify(cachePort).put(argThat(key -> key.targetDate().equals(today) && key.today() && key.limit() == 3), any(), eq(Duration.ofSeconds(600)));
    }

    @Test
    @DisplayName("날씨를 못 받은 격자가 있으면 빠진 결과라 캐시하지 않는다")
    void doesNotCacheDegradedResult() {
        givenCandidates(candidate(1L, TOURIST_SPOT, 33.40d), candidate(2L, CULTURE, 33.50d));
        when(weatherForecastProcessor.dailyForecastsAt(eq(33.40d), anyDouble(), any()))
            .thenThrow(new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE));
        givenWeather(33.50d, mild(today));

        processor.recommend(query(today, 3));

        verify(cachePort, never()).put(any(), any(), any());
    }

    @Test
    @DisplayName("결과가 비면 캐시하지 않는다 — 단기예보만 실패해 오늘이 비어도 격자 실패로 잡히지 않는 경우")
    void doesNotCacheEmptyResult() {
        givenCandidates(candidate(1L, TOURIST_SPOT, 33.40d), candidate(2L, CULTURE, 33.50d));
        // dailyForecastsAt 이 단기예보 실패를 삼키고 중기예보만 돌려준 모양 — 목록은 있는데 오늘이 없다.
        givenWeather(33.40d, mild(today.plusDays(4)));
        givenWeather(33.50d, mild(today.plusDays(4)));

        PlaceRecommendationInfo info = processor.recommend(query(today, 3));

        assertThat(info.places()).isEmpty();
        verify(cachePort, never()).put(any(), any(), any());
    }

    @Test
    @DisplayName("오늘이면 특보를 한 번만 읽어 판정 · 결론 · 캐시 키에 같은 값으로 쓴다")
    void todayReadsWarningOnceAndUsesIt() {
        WeatherWarning typhoon = WeatherWarning.builder()
            .type(WeatherWarningType.TYPHOON).level(WeatherWarningLevel.WARNING).sourceText("태풍경보").build();
        when(weatherWarningProcessor.heaviestWarning()).thenReturn(Optional.of(typhoon));
        givenCandidates(candidate(1L, TOURIST_SPOT, 33.40d), candidate(2L, CULTURE, 33.50d));
        givenWeather(33.40d, mild(today));
        givenWeather(33.50d, mild(today));

        PlaceRecommendationInfo info = processor.recommend(query(today, 3));

        verify(weatherWarningProcessor, times(1)).heaviestWarning();
        assertThat(info.weatherWarning()).isEqualTo(typhoon);
        // 경보는 점수를 0 으로 누른다(적합도와 같은 규칙). 0 은 점수가 있는 것이라 추천에서 빠지지 않는다.
        assertThat(info.places()).isNotEmpty().allSatisfy(place -> {
            assertThat(place.score().score()).isZero();
            assertThat(place.headline()).isEqualTo("기상특보가 있어 오늘은 바깥 활동을 줄이는 게 좋아요");
        });
        verify(cachePort).find(argThat(key -> key.today() && typhoon.equals(key.warning())));
    }

    @Test
    @DisplayName("미래 날짜면 특보를 조회하지 않고 키에도 특보가 없다")
    void futureDateSkipsWarning() {
        LocalDate tomorrow = today.plusDays(1);
        givenCandidates(candidate(1L, TOURIST_SPOT, 33.40d));
        givenWeather(33.40d, mild(tomorrow));

        PlaceRecommendationInfo info = processor.recommend(query(tomorrow, 3));

        verify(weatherWarningProcessor, never()).heaviestWarning();
        assertThat(info.weatherWarning()).isNull();
        assertThat(info.places()).singleElement().satisfies(place -> assertThat(place.headline()).isEqualTo("가기 좋아요"));
        verify(cachePort).find(argThat(key -> !key.today() && key.warning() == null));
    }

    /** 순위 · 다양성 규칙. 점수를 손으로 정해 동점 상황을 정확히 만든다. */
    @Nested
    class Selection {

        @Test
        @DisplayName("같은 점수면 동반 가능이 부분 허용보다 앞, 그다음 덜 붐비는 곳, 모름은 맨 뒤, 마지막은 아이디 순")
        void tieBreakers() {
            List<ScoredCandidate> ranked = List.of(
                scored(5L, TOURIST_SPOT, PetAllowanceType.ALLOWED, 80, null),
                scored(4L, CULTURE, PetAllowanceType.ALLOWED, 80, 70.0d),
                scored(3L, LEPORTS, PetAllowanceType.ALLOWED, 80, 20.0d),
                scored(2L, TOURIST_SPOT, PetAllowanceType.PARTIALLY_ALLOWED, 80, 10.0d),
                scored(6L, CULTURE, PetAllowanceType.ALLOWED, 80, null),
                scored(1L, LEPORTS, PetAllowanceType.ALLOWED, 90, 90.0d));

            List<ScoredCandidate> selected = PlaceRecommendationProcessor.selectDiverse(ranked, 10);

            assertThat(selected).extracting(scored -> scored.candidate().placeId())
                .containsExactly(1L, 3L, 4L, 5L, 6L, 2L);
        }

        @Test
        @DisplayName("같은 유형은 ceil(limit/2) 곳까지만 먼저 담고, 그 아래 순위의 다른 유형을 올린다")
        void capsSameContentType() {
            List<ScoredCandidate> ranked = List.of(
                scored(1L, TOURIST_SPOT, PetAllowanceType.ALLOWED, 95, null),
                scored(2L, TOURIST_SPOT, PetAllowanceType.ALLOWED, 90, null),
                scored(3L, TOURIST_SPOT, PetAllowanceType.ALLOWED, 85, null),
                scored(4L, CULTURE, PetAllowanceType.ALLOWED, 60, null));

            List<ScoredCandidate> selected = PlaceRecommendationProcessor.selectDiverse(ranked, 3);

            assertThat(selected).extracting(scored -> scored.candidate().placeId()).containsExactly(1L, 2L, 4L);
        }

        @Test
        @DisplayName("자리가 남으면 미뤄 둔 같은 유형으로 채우고, 고른 뒤에는 다시 점수 순으로 세운다")
        void fillsWithDeferredAndKeepsRankOrder() {
            List<ScoredCandidate> ranked = List.of(
                scored(1L, TOURIST_SPOT, PetAllowanceType.ALLOWED, 95, null),
                scored(2L, TOURIST_SPOT, PetAllowanceType.ALLOWED, 90, null),
                scored(3L, TOURIST_SPOT, PetAllowanceType.ALLOWED, 85, null),
                scored(4L, CULTURE, PetAllowanceType.ALLOWED, 60, null));

            List<ScoredCandidate> selected = PlaceRecommendationProcessor.selectDiverse(ranked, 4);

            // cap 2 → 1, 2, (3 미룸), 4 → 남은 한 자리를 3 으로 채운다. 3(85)이 4(60)보다 앞에 선다.
            assertThat(selected).extracting(scored -> scored.candidate().placeId()).containsExactly(1L, 2L, 3L, 4L);
        }

        @Test
        @DisplayName("후보가 한 유형뿐이어도 limit 을 채운다")
        void singleTypeStillFillsLimit() {
            List<ScoredCandidate> ranked = List.of(
                scored(1L, TOURIST_SPOT, PetAllowanceType.ALLOWED, 95, null),
                scored(2L, TOURIST_SPOT, PetAllowanceType.ALLOWED, 90, null),
                scored(3L, TOURIST_SPOT, PetAllowanceType.ALLOWED, 85, null));

            assertThat(PlaceRecommendationProcessor.selectDiverse(ranked, 3)).hasSize(3);
        }

        private ScoredCandidate scored(long id, String contentTypeId, PetAllowanceType allowance, int score, Double congestionRate) {
            RecommendationCandidate candidate = RecommendationCandidate.builder()
                .place(PlaceCondition.builder().placeId(id).petAllowanceType(allowance).lat(33.4d).lng(126.5d).build())
                .contentTypeId(contentTypeId)
                .build();
            CongestionSnapshot congestion = congestionRate == null
                ? CongestionSnapshot.unknown(today)
                : CongestionSnapshot.of(today, congestionRate);
            return new ScoredCandidate(candidate, SuitabilityScore.scored(score, List.of(), true, congestion.isKnown()), null, congestion);
        }
    }

    private void givenCandidates(RecommendationCandidate... candidates) {
        when(placeProfileQueryPort.findRecommendationCandidates(anyString(), anyCollection())).thenReturn(List.of(candidates));
    }

    private void givenWeather(double lat, DailyWeather daily) {
        when(weatherForecastProcessor.dailyForecastsAt(eq(lat), anyDouble(), any())).thenReturn(List.of(daily));
    }

    private static RecommendationCandidate candidate(long id, String contentTypeId, double lat) {
        return RecommendationCandidate.builder()
            .place(PlaceCondition.builder()
                .placeId(id)
                .title("장소 " + id)
                .sigunguCode("4")
                .lat(lat)
                .lng(126.53d)
                .petAllowanceType(PetAllowanceType.ALLOWED)
                .outdoor(true)
                .build())
            .contentTypeId(contentTypeId)
            .addr1("제주특별자치도 제주시")
            .firstImage("https://img/" + id + ".jpg")
            .build();
    }

    private static DailyWeather mild(LocalDate date) {
        return weather(date, 24.0d, 10, PrecipitationType.NONE);
    }

    private static DailyWeather hot(LocalDate date) {
        return weather(date, 29.5d, 10, PrecipitationType.NONE);
    }

    private static DailyWeather rainy(LocalDate date) {
        return weather(date, 24.0d, 80, PrecipitationType.RAIN);
    }

    private static DailyWeather weather(LocalDate date, double maxTemperature, int rainChance, PrecipitationType type) {
        return DailyWeather.builder()
            .date(date)
            .source(ForecastSource.SHORT_TERM)
            .minTemperature(18.0d)
            .maxTemperature(maxTemperature)
            .maxPrecipitationProbability(rainChance)
            .worstPrecipitationType(type)
            .maxWindSpeed(2.0d)
            .build();
    }

    private PlaceRecommendationQuery query(LocalDate date, int limit) {
        return PlaceRecommendationQuery.builder().targetDate(date).petCondition(PetCondition.unspecified()).limit(limit).build();
    }
}

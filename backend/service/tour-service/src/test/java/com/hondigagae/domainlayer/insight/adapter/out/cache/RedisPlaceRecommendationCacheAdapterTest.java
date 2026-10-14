package com.hondigagae.domainlayer.insight.adapter.out.cache;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hondigagae.domainlayer.insight.application.info.AlternativePlaceInfo;
import com.hondigagae.domainlayer.insight.application.info.PlaceRecommendationInfo;
import com.hondigagae.domainlayer.insight.application.info.RecommendedPlaceInfo;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapperImpl;
import com.hondigagae.domainlayer.insight.application.model.PlaceRecommendationCacheKey;
import com.hondigagae.domainlayer.insight.application.port.out.query.CachedPlaceRecommendationQueryResult;
import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.domainlayer.insight.domain.enums.SuitabilityReasonCode;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningLevel;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningType;
import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import com.hondigagae.domainlayer.insight.domain.model.PrecipitationAmount;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityReason;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityScore;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.redis.properties.RedisProperties;
import com.hondigagae.shared.travel.insight.ForecastSource;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/**
 * 장소 추천 캐시의 저장 형식과 키 (#1368).
 *
 * <p>역직렬화 실패는 어댑터가 캐시 미스로 삼키므로 깨져도 예외가 나지 않는다 — 증상은 "영구 캐시 미스" 이고 매 요청이
 * 후보 전부를 다시 판정한다. 그래서 Spring Boot 가 실제로 주입하는 ObjectMapper 로 왕복을 못박는다
 * ({@code CachedWeatherEnvelopeSerializationTest} 와 같은 이유).
 */
class RedisPlaceRecommendationCacheAdapterTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(JacksonAutoConfiguration.class));
    private final InsightMapper insightMapper = new InsightMapperImpl();

    @Test
    @DisplayName("추천 결과가 Info → 캐시 값 → JSON → 캐시 값 → Info 왕복을 거쳐도 그대로다")
    void roundTripsThroughJson() {
        contextRunner.run(context -> {
            ObjectMapper objectMapper = context.getBean(ObjectMapper.class);
            PlaceRecommendationInfo original = sampleInfo();

            String json = objectMapper.writeValueAsString(insightMapper.toRecommendationQueryResult(original));
            PlaceRecommendationInfo restored = insightMapper.toRecommendationInfo(
                objectMapper.readValue(json, CachedPlaceRecommendationQueryResult.class));

            assertThat(restored).isEqualTo(original);
            // 실내 대안의 장소 유형 · 원본 분류(#1461)도 왕복한다 — 위 동등 비교가 이미 보지만, 빠지면 어디가 빠졌는지 바로 읽히게 한다.
            AlternativePlaceInfo alternative = restored.places().getFirst().indoorAlternatives().getFirst();
            assertThat(alternative.contentTypeId()).isEqualTo("39");
            assertThat(alternative.sourceCategory()).isEqualTo("카페");
        });
    }

    /**
     * 실내 대안에 칸을 더한 배포(#1461) 직후에는 칸이 없는 옛 항목이 Redis 에 남아 있다(최대 TTL 600초).
     *
     * <p>그 항목을 읽지 못하면 어댑터가 캐시 미스로 삼켜 겉으로는 아무 일도 없다 — 그래서 여기서 직접 읽어 본다.
     * 키 버전을 올리지 않는 근거가 이 테스트다: 옛 항목은 새 칸만 null 인 채로 읽힌다.
     */
    @Test
    @DisplayName("새 칸이 없는 옛 캐시 항목도 읽힌다 — 실내 대안의 장소 유형 · 원본 분류만 null 이다")
    void readsEntryWrittenBeforeAlternativeContentType() {
        contextRunner.run(context -> {
            ObjectMapper objectMapper = context.getBean(ObjectMapper.class);
            JsonNode tree = objectMapper.valueToTree(insightMapper.toRecommendationQueryResult(sampleInfo()));
            ObjectNode oldAlternative = (ObjectNode) tree.path("places").path(0).path("indoorAlternatives").path(0);
            oldAlternative.remove(List.of("contentTypeId", "sourceCategory"));

            CachedPlaceRecommendationQueryResult cached =
                objectMapper.readValue(objectMapper.writeValueAsString(tree), CachedPlaceRecommendationQueryResult.class);

            CachedPlaceRecommendationQueryResult.Alternative alternative = cached.places().getFirst().indoorAlternatives().getFirst();
            assertThat(alternative.title()).isEqualTo("오설록 티뮤지엄");
            assertThat(alternative.contentTypeId()).isNull();
            assertThat(alternative.sourceCategory()).isNull();
        });
    }

    @Test
    @DisplayName("반려견 조건 키는 판정에 쓰는 값을 모두 담고, 빈 견종은 없음과 같다")
    void petKeyCoversEveryJudgedField() {
        assertThat(RedisPlaceRecommendationCacheAdapter.petKey(PetCondition.unspecified()))
            .isEqualTo("size=-,act=-,soc=-,heat=0,cold=0,noise=0,breed=-");
        assertThat(RedisPlaceRecommendationCacheAdapter.petKey(PetCondition.builder().breed("  ").build()))
            .isEqualTo(RedisPlaceRecommendationCacheAdapter.petKey(PetCondition.unspecified()));

        String specified = RedisPlaceRecommendationCacheAdapter.petKey(PetCondition.builder()
            .sizeType(PetSizeType.SMALL).activityLevel(ActivityLevel.HIGH).heatSensitive(true).noiseSensitive(true)
            .breed("퍼그").build());
        assertThat(specified).isEqualTo("size=SMALL,act=HIGH,soc=-,heat=1,cold=0,noise=1,breed=%ED%8D%BC%EA%B7%B8");
        // 견종은 근거 문구의 주어로 들어가므로 견종이 다르면 키도 다르다.
        assertThat(RedisPlaceRecommendationCacheAdapter.petKey(PetCondition.builder().breed("시츄").build()))
            .isNotEqualTo(RedisPlaceRecommendationCacheAdapter.petKey(PetCondition.builder().breed("퍼그").build()));
        // 키 구분자(:)가 자유 입력에서 새어 들지 않는다.
        assertThat(RedisPlaceRecommendationCacheAdapter.petKey(PetCondition.builder().breed("a:b").build())).doesNotContain(":");
    }

    @Test
    @DisplayName("키는 날짜 · 오늘 여부 · 특보 · 반려견 조건 · 개수로 갈린다")
    void keySeparatesTodayAndWarning() {
        RedisProperties redisProperties = mock(RedisProperties.class);
        when(redisProperties.normalizedKeyPrefix()).thenReturn("hondi");
        RedisPlaceRecommendationCacheAdapter adapter = new RedisPlaceRecommendationCacheAdapter(null, redisProperties, null);
        LocalDate date = LocalDate.of(2026, 10, 11);
        WeatherWarning typhoon = WeatherWarning.builder().type(WeatherWarningType.TYPHOON).level(WeatherWarningLevel.WARNING)
            .effectiveAt(LocalDateTime.of(2026, 10, 11, 9, 0)).build();

        String todayNoWarning = adapter.buildKey(key(date, true, null));
        String otherDay = adapter.buildKey(key(date, false, null));
        String todayWarning = adapter.buildKey(key(date, true, typhoon));

        assertThat(todayNoWarning).isEqualTo("hondi:insight:recommendation:2026-10-11:today:none:"
            + "size=-,act=-,soc=-,heat=0,cold=0,noise=0,breed=-:3");
        // 23:58 에 "내일" 로 계산한 결과를 자정 뒤 "오늘" 로 주지 않는다.
        assertThat(otherDay).isNotEqualTo(todayNoWarning);
        assertThat(todayWarning).contains(":WARNING-TYPHOON-202610110900:");
    }

    private static PlaceRecommendationCacheKey key(LocalDate date, boolean today, WeatherWarning warning) {
        return PlaceRecommendationCacheKey.builder()
            .targetDate(date).today(today).warning(warning).petCondition(PetCondition.unspecified()).limit(3).build();
    }

    private static PlaceRecommendationInfo sampleInfo() {
        LocalDate date = LocalDate.of(2026, 10, 11);
        SuitabilityScore score = SuitabilityScore.scored(
            85,
            List.of(SuitabilityReason.of(SuitabilityReasonCode.PET_PARTIALLY_ALLOWED, "일부 구역만 동반 가능합니다.", -15)),
            true, true);
        RecommendedPlaceInfo place = RecommendedPlaceInfo.builder()
            .placeId(212481712381923328L)
            .contentTypeId("12")
            .title("가세오름")
            .addr1("제주특별자치도 서귀포시 표선면 가시리")
            .sigunguCode("3")
            .lat(33.3608276172d)
            .lng(126.7818122232d)
            .firstImage("https://img/1.jpg")
            .firstImage2(null)
            .petAllowanceType(PetAllowanceType.PARTIALLY_ALLOWED)
            .maxPetWeightKg(12)
            .indoor(null)
            .score(score)
            .headline("가기 좋아요")
            .weather(DailyWeather.builder()
                .date(date)
                .source(ForecastSource.SHORT_TERM)
                .minTemperature(18.0d)
                .maxTemperature(24.0d)
                .maxPrecipitationProbability(70)
                .worstPrecipitationType(PrecipitationType.RAIN)
                .maxWindSpeed(2.0d)
                .totalPrecipitationMm(3.0d)
                // 시각별 예보까지 왕복시킨다 — 예보 캐시 테스트는 WeatherForecast 목록만 보고 DailyWeather 안의 것은 보지 않는다.
                .hourly(List.of(WeatherForecast.builder()
                    .nx(53).ny(38)
                    .forecastAt(date.atTime(14, 0))
                    .baseAt(date.atTime(11, 0))
                    .temperature(24.0d)
                    .precipitationProbability(70)
                    .precipitationType(PrecipitationType.RAIN)
                    .skyState(SkyState.OVERCAST)
                    .humidity(78)
                    .windSpeed(2.0d)
                    .precipitation(PrecipitationAmount.parse("1.0mm"))
                    .build()))
                .build())
            .congestion(CongestionSnapshot.of(date, 42.5d))
            .indoorAlternatives(List.of(AlternativePlaceInfo.builder()
                .placeId(1L).title("오설록 티뮤지엄").lat(33.3d).lng(126.3d).distanceMeters(2340)
                .petAllowanceType(PetAllowanceType.ALLOWED).allowedPetSize(AllowedPetSize.SMALL_ONLY)
                .contentTypeId("39").sourceCategory("카페").build()))
            .petConditionApplied(true)
            .build();

        return PlaceRecommendationInfo.builder()
            .targetDate(date)
            .weatherWarning(WeatherWarning.builder()
                .type(WeatherWarningType.values()[0])
                .level(WeatherWarningLevel.values()[0])
                .effectiveAt(LocalDateTime.of(2026, 10, 11, 9, 0))
                .sourceText("강풍주의보")
                .build())
            .places(List.of(place))
            .build();
    }
}

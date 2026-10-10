package com.hondigagae.domainlayer.insight.adapter.out.cache;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.insight.adapter.out.cache.RedisWeatherForecastCacheAdapter.CachedWeatherEnvelope;
import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.domainlayer.insight.domain.model.PrecipitationAmount;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/**
 * 캐시 저장 포맷의 직렬화 왕복을 고정한다.
 *
 * <p>이 경로가 깨져도 <b>예외가 나지 않는다.</b> 어댑터가 역직렬화 실패를 캐시 미스로
 * 삼키기 때문이다(그것 자체는 옳다 - 캐시는 데이터의 원천이 아니다). 대신 증상이
 * "영구 캐시 미스"가 되어 기능은 멀쩡히 동작하는 채로 공공 API 일 1,000건 쿼터만 태운다.
 * 조용히 나빠지는 종류의 고장이라 테스트로 못박는다.
 *
 * <p>ObjectMapper 는 손으로 만들지 않고 <b>Spring Boot 가 실제로 주입하는 것</b>을 쓴다.
 * 직접 만든 mapper 로 통과시키면 운영과 다른 설정을 검증하게 된다.
 */
class CachedWeatherEnvelopeSerializationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(JacksonAutoConfiguration.class));

    @Test
    @DisplayName("예보 목록이 JSON 왕복을 거쳐도 값이 그대로 살아 있다")
    void roundTripsThroughJson() {
        contextRunner.run(context -> {
            ObjectMapper objectMapper = context.getBean(ObjectMapper.class);
            CachedWeatherEnvelope original = new CachedWeatherEnvelope(
                List.of(sampleForecast()), LocalDateTime.of(2026, 8, 27, 17, 10));

            String json = objectMapper.writeValueAsString(original);
            CachedWeatherEnvelope restored = objectMapper.readValue(json, CachedWeatherEnvelope.class);

            assertThat(restored.freshUntil()).isEqualTo(original.freshUntil());
            assertThat(restored.forecasts()).hasSize(1);

            WeatherForecast forecast = restored.forecasts().get(0);
            assertThat(forecast.nx()).isEqualTo(53);
            assertThat(forecast.ny()).isEqualTo(38);
            assertThat(forecast.forecastAt()).isEqualTo(LocalDate.of(2026, 8, 27).atTime(14, 0));
            assertThat(forecast.temperature()).isEqualTo(31.0d);
            assertThat(forecast.humidity()).isEqualTo(78);
            assertThat(forecast.precipitationProbability()).isEqualTo(80);
        });
    }

    @Test
    @DisplayName("enum 과 강수량 전용 타입도 뜻을 잃지 않는다")
    void keepsEnumsAndPrecipitationMeaning() {
        contextRunner.run(context -> {
            ObjectMapper objectMapper = context.getBean(ObjectMapper.class);
            CachedWeatherEnvelope original = new CachedWeatherEnvelope(
                List.of(sampleForecast()), LocalDateTime.of(2026, 8, 27, 17, 10));

            CachedWeatherEnvelope restored = objectMapper.readValue(
                objectMapper.writeValueAsString(original), CachedWeatherEnvelope.class);
            WeatherForecast forecast = restored.forecasts().get(0);

            assertThat(forecast.skyState()).isEqualTo(SkyState.OVERCAST);
            assertThat(forecast.precipitationType()).isEqualTo(PrecipitationType.RAIN);
            // 범위 표기의 원문이 살아 있어야 화면이 "30.0~50.0mm" 를 그대로 보여 줄 수 있다.
            assertThat(forecast.precipitation().text()).isEqualTo("30.0~50.0mm");
            assertThat(forecast.precipitation().millimeters()).isEqualTo(30.0d);
            assertThat(forecast.isWet()).isTrue();
        });
    }

    @Test
    @DisplayName("값이 없는 항목은 null 로 남는다 - 0 으로 채워지지 않는다")
    void keepsAbsentValuesNull() {
        contextRunner.run(context -> {
            ObjectMapper objectMapper = context.getBean(ObjectMapper.class);
            WeatherForecast sparse = WeatherForecast.builder()
                .nx(53).ny(38)
                .forecastAt(LocalDate.of(2026, 8, 27).atTime(3, 0))
                .baseAt(LocalDate.of(2026, 8, 27).atTime(2, 0))
                .temperature(24.0d)
                .build();

            CachedWeatherEnvelope restored = objectMapper.readValue(
                objectMapper.writeValueAsString(new CachedWeatherEnvelope(List.of(sparse), null)),
                CachedWeatherEnvelope.class);
            WeatherForecast forecast = restored.forecasts().get(0);

            // TMN/TMX 는 하루 한 번만 오므로 대부분의 시각에서 없는 것이 정상이다.
            assertThat(forecast.minTemperature()).isNull();
            assertThat(forecast.maxTemperature()).isNull();
            assertThat(forecast.humidity()).isNull();
            assertThat(forecast.precipitationProbability()).isNull();
            assertThat(restored.freshUntil()).isNull();
        });
    }

    private static WeatherForecast sampleForecast() {
        return WeatherForecast.builder()
            .nx(53).ny(38)
            .forecastAt(LocalDate.of(2026, 8, 27).atTime(14, 0))
            .baseAt(LocalDate.of(2026, 8, 27).atTime(11, 0))
            .temperature(31.0d)
            .precipitationProbability(80)
            .precipitationType(PrecipitationType.RAIN)
            .skyState(SkyState.OVERCAST)
            .humidity(78)
            .windSpeed(4.2d)
            .precipitation(PrecipitationAmount.parse("30.0~50.0mm"))
            .maxTemperature(32.0d)
            .build();
    }
}

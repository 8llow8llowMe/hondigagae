package com.hondigagae.domainlayer.insight.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.insight.adapter.in.internal.dto.WeatherWarningInternalResponse;
import com.hondigagae.domainlayer.insight.adapter.in.internal.presenter.InsightInternalPresenter;
import com.hondigagae.domainlayer.insight.application.service.processor.WeatherForecastProcessor;
import com.hondigagae.domainlayer.insight.application.service.processor.WeatherWarningProcessor;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningLevel;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningType;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 내부 특보 엔드포인트가 내보내는 값 검증.
 *
 * <p>고정하는 것은 둘이다.
 * <ul>
 *   <li><b>경보 판정을 tour 가 준다</b> — {@code recommendationSuppressed}. 소비 측(plan-service)이
 *       {@code levelCode.equals("WARNING")} 으로 다시 세우면 규칙이 두 곳으로 갈라진다 (#357)
 *   <li><b>특보가 없으면 empty</b> — 호출부가 "붙일 특보 없음" 으로 그냥 넘어갈 수 있어야 한다
 * </ul>
 */
class InsightInternalFacadeTest {

    private final WeatherWarningProcessor weatherWarningProcessor = mock(WeatherWarningProcessor.class);
    private final InsightInternalFacade facade = new InsightInternalFacade(
        mock(WeatherForecastProcessor.class), weatherWarningProcessor, new InsightInternalPresenter());

    @Test
    @DisplayName("발효 중인 특보가 없으면 empty 다 — 호출부는 특보 절을 생략한다")
    void returnsEmptyWhenNoWarning() {
        when(weatherWarningProcessor.heaviestWarning()).thenReturn(Optional.empty());

        assertThat(facade.getActiveWeatherWarning()).isEmpty();
    }

    @Test
    @DisplayName("경보는 recommendationSuppressed=true 와 함께 나간다 — 소비 측이 단계를 다시 판정하지 않는다")
    void warningLevelCarriesSuppressionFlag() {
        when(weatherWarningProcessor.heaviestWarning()).thenReturn(Optional.of(WeatherWarning.builder()
            .type(WeatherWarningType.TYPHOON)
            .level(WeatherWarningLevel.WARNING)
            .effectiveAt(LocalDateTime.of(2026, 9, 10, 6, 0))
            .sourceText("태풍경보")
            .build()));

        WeatherWarningInternalResponse response = facade.getActiveWeatherWarning().orElseThrow();

        assertThat(response.typeCode()).isEqualTo("TYPHOON");
        assertThat(response.typeName()).isEqualTo("태풍");
        assertThat(response.typeDescription()).isEqualTo(WeatherWarningType.TYPHOON.getDescription());
        assertThat(response.levelCode()).isEqualTo("WARNING");
        assertThat(response.levelName()).isEqualTo("경보");
        assertThat(response.recommendationSuppressed()).isTrue();
        assertThat(response.effectiveAt()).isEqualTo(LocalDateTime.of(2026, 9, 10, 6, 0));
    }

    @Test
    @DisplayName("주의보는 recommendationSuppressed=false — 특보가 있다는 사실은 그대로 전달한다")
    void advisoryDoesNotSuppressRecommendation() {
        when(weatherWarningProcessor.heaviestWarning()).thenReturn(Optional.of(WeatherWarning.builder()
            .type(WeatherWarningType.HEAT_WAVE)
            .level(WeatherWarningLevel.ADVISORY)
            .sourceText("폭염주의보")
            .build()));

        WeatherWarningInternalResponse response = facade.getActiveWeatherWarning().orElseThrow();

        assertThat(response.typeCode()).isEqualTo("HEAT_WAVE");
        assertThat(response.levelCode()).isEqualTo("ADVISORY");
        assertThat(response.recommendationSuppressed()).isFalse();
        // 원천이 발효 시각을 주지 않으면 null 유지 — 지어내지 않는다
        assertThat(response.effectiveAt()).isNull();
    }
}

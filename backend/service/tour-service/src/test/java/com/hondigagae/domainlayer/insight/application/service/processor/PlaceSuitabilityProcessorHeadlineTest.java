package com.hondigagae.domainlayer.insight.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.insight.application.info.PlaceSuitabilityInfo;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.application.model.PlaceInsightQuery;
import com.hondigagae.domainlayer.insight.application.port.out.CongestionForecastPort;
import com.hondigagae.domainlayer.insight.application.port.out.PlaceProfileQueryPort;
import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import com.hondigagae.domainlayer.insight.domain.model.PlaceCondition;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityThresholds;
import com.hondigagae.global.properties.InsightProperties;
import com.hondigagae.shared.travel.insight.ForecastSource;
import com.hondigagae.shared.travel.insight.SuitabilityLevel;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 적합도 결론 문구의 "오늘" 판정 (#1234).
 *
 * <p>문구 규칙 자체는 {@code SuitabilityHeadlineTest} 가 본다. 여기서 고정하는 것은 Processor 가
 * <b>기준 일자가 오늘인지를 특보 판정과 같은 방식으로</b> 넘기는가다 - 다른 날짜를 물었는데
 * "오늘 가기 좋아요" 가 나가면 거짓이고, 특보는 붙었는데 문구가 "오늘" 을 빼면 둘이 어긋난다.
 */
class PlaceSuitabilityProcessorHeadlineTest {

    private static final long PLACE_ID = 212481712381923328L;

    private final PlaceProfileQueryPort placeProfileQueryPort = mock(PlaceProfileQueryPort.class);
    private final CongestionForecastPort congestionForecastPort = mock(CongestionForecastPort.class);
    private final WeatherForecastProcessor weatherForecastProcessor = mock(WeatherForecastProcessor.class);
    private final InsightMapper insightMapper = mock(InsightMapper.class);
    private final WeatherWarningProcessor weatherWarningProcessor = mock(WeatherWarningProcessor.class);
    private final PlaceSuitabilityProcessor processor = new PlaceSuitabilityProcessor(
        placeProfileQueryPort, congestionForecastPort, weatherForecastProcessor, insightMapper,
        new InsightProperties(null, null, null, null, null, null, null, null, null, null, null, null),
        weatherWarningProcessor);

    @BeforeEach
    void setUp() {
        when(placeProfileQueryPort.findProfile(PLACE_ID)).thenReturn(Optional.of(PlaceCondition.builder()
            .placeId(PLACE_ID)
            .title("천지연폭포")
            .lat(33.2471d)
            .lng(126.5547d)
            .petAllowanceType(PetAllowanceType.ALLOWED)
            .outdoor(true)
            .build()));
        when(insightMapper.toThresholds(any())).thenReturn(SuitabilityThresholds.builder()
            .rainProbabilityPercent(60)
            .hotTemperature(28.0d).veryHotTemperature(31.0d)
            .coldTemperature(5.0d).veryColdTemperature(0.0d)
            .strongWindSpeed(9.0d)
            .build());
        when(weatherWarningProcessor.heaviestWarning()).thenReturn(Optional.empty());
    }

    @Test
    @DisplayName("기준 일자가 오늘이면 '오늘' 이 든 결론을 싣는다")
    void todayHeadline() {
        LocalDate today = LocalDate.now();
        givenMildWeatherOn(today);

        PlaceSuitabilityInfo info = processor.evaluate(query(today));

        assertThat(info.score().level()).isEqualTo(SuitabilityLevel.HIGH);
        assertThat(info.headline()).isEqualTo("오늘 가기 좋아요");
        // 같은 판정이 특보 조회도 연다.
        verify(weatherWarningProcessor).heaviestWarning();
    }

    @Test
    @DisplayName("다른 날짜면 '오늘' 을 빼고 말한다")
    void otherDayHeadline() {
        LocalDate dayAfterTomorrow = LocalDate.now().plusDays(2);
        givenMildWeatherOn(dayAfterTomorrow);

        PlaceSuitabilityInfo info = processor.evaluate(query(dayAfterTomorrow));

        assertThat(info.score().level()).isEqualTo(SuitabilityLevel.HIGH);
        assertThat(info.headline()).isEqualTo("가기 좋아요");
        verify(weatherWarningProcessor, never()).heaviestWarning();
    }

    @Test
    @DisplayName("날씨를 못 써 판단 근거가 부족하면 결론은 null 이다")
    void insufficientHasNoHeadline() {
        LocalDate today = LocalDate.now();
        when(weatherForecastProcessor.dailyForecastsAt(anyDouble(), anyDouble(), any())).thenReturn(List.of());

        PlaceSuitabilityInfo info = processor.evaluate(query(today));

        assertThat(info.score().level()).isEqualTo(SuitabilityLevel.INSUFFICIENT);
        assertThat(info.headline()).isNull();
    }

    private void givenMildWeatherOn(LocalDate date) {
        when(weatherForecastProcessor.dailyForecastsAt(anyDouble(), anyDouble(), any())).thenReturn(List.of(
            DailyWeather.builder()
                .date(date)
                .source(ForecastSource.SHORT_TERM)
                .minTemperature(18.0d)
                .maxTemperature(24.0d)
                .maxPrecipitationProbability(10)
                .worstPrecipitationType(PrecipitationType.NONE)
                .maxWindSpeed(2.0d)
                .build()));
        when(congestionForecastPort.findByPlaceAndDate(anyLong(), any())).thenReturn(null);
    }

    private static PlaceInsightQuery query(LocalDate targetDate) {
        return PlaceInsightQuery.builder()
            .placeId(PLACE_ID)
            .targetDate(targetDate)
            .petCondition(PetCondition.unspecified())
            .build();
    }
}

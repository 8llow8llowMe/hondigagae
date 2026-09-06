package com.hondigagae.domainlayer.insight.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.info.WalkTimesInfo;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapperImpl;
import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.enums.GoldenWindowStatus;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningLevel;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningType;
import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.global.properties.InsightProperties;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 골든타임이 <b>언제 실패해야 하는가</b>.
 *
 * <p>이 화면은 밤마다 "오늘 남은 예보 없음" 상태가 된다. 기상청 단기예보 23시 회차가 자기
 * 발표일 행을 하나도 주지 않기 때문이다 — 실측으로 확인했다({@code base_date=20260903&
 * base_time=2300} 의 최초 예보가 20260904 0000). 그것을 5xx 로 올리면 재시도해도 자정 전에는
 * 풀리지 않는 것을 "잠시 후 다시 시도해 주세요"라고 말하게 되고, 프론트는 조회 실패로 보고
 * 섹션을 통째로 숨겨 사용자는 이유조차 알 수 없다.
 *
 * <p>그래서 여기서 고정하는 것은 곡선의 내용이 아니라 <b>빈 곡선의 처리</b>, 그리고
 * <b>추천이 없는 이유를 정확히 말하는가</b>다 ({@link GoldenWindowStatus}).
 */
class WalkTimesProcessorTest {

    private static final double LAT = 33.4996d;
    private static final double LNG = 126.5312d;

    @Test
    @DisplayName("오늘 예보가 없고 내일치만 있어도 실패시키지 않는다")
    void doesNotFailWhenOnlyTomorrowIsForecast() {
        // 23시 회차를 받은 직후의 모습이다. 이것이 이 이슈의 재현 조건이다.
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        WalkTimesInfo info = processor(() -> List.of(
            forecast(tomorrow.atTime(9, 0), 22.0d),
            forecast(tomorrow.atTime(12, 0), 26.0d))).findWalkTimes(LAT, LNG, PetCondition.unspecified());

        assertThat(info.curve()).isEmpty();
        assertThat(info.goldenWindow()).isNull();
        assertThat(info.forecastCoverage()).isEqualTo(ForecastCoverage.DAY_ENDED);
        // 정상 상태다. 재시도를 권하는 코드로 나가면 안 된다.
        assertThat(info.forecastCoverage().isFailure()).isFalse();
    }

    @Test
    @DisplayName("오늘 행이 있어도 곡선을 못 그리면 빈 곡선을 그대로 준다")
    void doesNotFailWhenTodayHasNoUsableReading() {
        // 실제로는 남은 시각이 없을 때(23시대) 이 갈래로 온다. 시각에 기대지 않으려고
        // 기온 없는 행으로 같은 상태를 만든다 - hourlyCurve 가 기온 없는 시각을 뺀다.
        WalkTimesInfo info = processor(() -> List.of(
            forecast(LocalDate.now().atTime(12, 0), null))).findWalkTimes(LAT, LNG, PetCondition.unspecified());

        assertThat(info.curve()).isEmpty();
        assertThat(info.forecastCoverage()).isEqualTo(ForecastCoverage.DAY_ENDED);
    }

    @Test
    @DisplayName("예보를 못 받은 것은 빈 곡선과 다른 상태로 남는다")
    void marksOriginFailureAsUnavailable() {
        // 둘 다 곡선은 비지만 사용자가 할 일이 다르다 - 이쪽만 다시 시도할 일이다.
        WalkTimesInfo info = processor(() -> {
            throw new InsightException(InsightErrorCode.WEATHER_UNAVAILABLE);
        }).findWalkTimes(LAT, LNG, PetCondition.unspecified());

        assertThat(info.curve()).isEmpty();
        assertThat(info.forecastCoverage()).isEqualTo(ForecastCoverage.UNAVAILABLE);
        assertThat(info.forecastCoverage().isFailure()).isTrue();
    }

    @Test
    @DisplayName("설정 오류는 200 뒤에 숨기지 않는다")
    void doesNotSwallowConfigurationFault() {
        // serviceKey 가 없는 배포는 저절로 낫지 않는다. "오늘은 예보가 없네"로 읽히면
        // 며칠이고 발견되지 않는다.
        assertThatThrownBy(() -> processor(() -> {
            throw new InsightException(InsightErrorCode.WEATHER_SERVICE_KEY_MISSING);
        }).findWalkTimes(LAT, LNG, PetCondition.unspecified()))
            .isInstanceOf(InsightException.class)
            .hasFieldOrPropertyWithValue("errorCode", InsightErrorCode.WEATHER_SERVICE_KEY_MISSING);
    }

    @Test
    @DisplayName("어떤 예보 상태에서도 예외로 끝나지 않는다")
    void neverThrowsOnForecastState() {
        LocalDate today = LocalDate.now();
        List<Supplier<List<WeatherForecast>>> states = List.of(
            List::of,
            () -> List.of(forecast(today.plusDays(1).atTime(9, 0), 22.0d)),
            () -> List.of(forecast(today.atTime(12, 0), 26.0d)));

        for (Supplier<List<WeatherForecast>> state : states) {
            assertThatCode(() -> processor(state).findWalkTimes(LAT, LNG, PetCondition.unspecified()))
                .doesNotThrowAnyException();
        }
    }

    @Test
    @DisplayName("예보가 없는 밤에는 위험이라고 단정하지 않는다 - 모르는 것은 모르는 것이다")
    void reportsNoForecastRatherThanRisk() {
        // 곡선이 비었을 때 "남은 시간이 전부 위험"이라고 하면 모르는 것을 나쁜 것으로 말하는
        // 것이다. 경보가 함께 떠 있어도 없는 예보를 근거로 삼지는 않는다.
        WalkTimesInfo info = processor(
            () -> List.of(forecast(LocalDate.now().plusDays(1).atTime(9, 0), 22.0d)),
            warning(WeatherWarningLevel.WARNING))
            .findWalkTimes(LAT, LNG, PetCondition.unspecified());

        assertThat(info.curve()).isEmpty();
        assertThat(info.goldenWindowStatus()).isEqualTo(GoldenWindowStatus.NO_FORECAST);
    }

    // --- fixtures ---

    private WalkTimesProcessor processor(Supplier<List<WeatherForecast>> forecasts) {
        return processor(forecasts, null);
    }

    private WalkTimesProcessor processor(Supplier<List<WeatherForecast>> forecasts, WeatherWarning warning) {
        WeatherForecastProcessor forecastProcessor =
            new WeatherForecastProcessor(null, null, null, null, null, null) {

                @Override
                public List<WeatherForecast> forecastsAt(double lat, double lng) {
                    return forecasts.get();
                }
            };

        return new WalkTimesProcessor(forecastProcessor, warningProcessor(warning), mapper(), properties());
    }

    /** 특보는 대부분의 테스트에서 관심사가 아니라 기본은 없음이다. */
    private WeatherWarningProcessor warningProcessor(WeatherWarning warning) {
        return new WeatherWarningProcessor(null, null, null) {

            @Override
            public Optional<WeatherWarning> heaviestWarning() {
                return Optional.ofNullable(warning);
            }
        };
    }

    private static WeatherWarning warning(WeatherWarningLevel level) {
        return WeatherWarning.builder()
            .type(WeatherWarningType.WIND_WAVE)
            .level(level)
            .build();
    }

    /** 매퍼는 스텁하지 않고 MapStruct 가 만든 실물을 쓴다 - 임계값 변환도 함께 검증된다. */
    private InsightMapper mapper() {
        return new InsightMapperImpl();
    }

    /** 전부 null 로 넘기면 record 생성자가 기본 임계값을 채운다. */
    private InsightProperties properties() {
        return new InsightProperties(null, null, null, null, null, null, null, null, null, null, null, null);
    }

    private static WeatherForecast forecast(LocalDateTime at, Double temperature) {
        return WeatherForecast.builder()
            .forecastAt(at)
            .temperature(temperature)
            .humidity(50)
            .skyState(SkyState.CLEAR)
            .precipitationProbability(10)
            .build();
    }
}

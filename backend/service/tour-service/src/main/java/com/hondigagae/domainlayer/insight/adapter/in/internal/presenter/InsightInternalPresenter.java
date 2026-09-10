package com.hondigagae.domainlayer.insight.adapter.in.internal.presenter;

import com.hondigagae.domainlayer.insight.adapter.in.internal.dto.DailyWeatherInternalResponse;
import com.hondigagae.domainlayer.insight.adapter.in.internal.dto.WeatherWarningInternalResponse;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class InsightInternalPresenter {

    public List<DailyWeatherInternalResponse> toDailyWeatherResponses(List<DailyWeather> dailies) {
        return dailies.stream()
            .map(this::toDailyWeatherResponse)
            .toList();
    }

    /** 프롬프트에 바로 실을 수 있게 enum 은 표시명으로 바꿔 준다. 없는 값은 null 유지 — 지어내지 않는다. */
    private DailyWeatherInternalResponse toDailyWeatherResponse(DailyWeather daily) {
        return DailyWeatherInternalResponse.builder()
            .date(daily.date())
            .forecastSourceName(daily.source() == null ? null : daily.source().getDisplayName())
            .skyStateName(daily.representativeSkyState() == null ? null : daily.representativeSkyState().getDisplayName())
            .precipitationTypeName(daily.worstPrecipitationType() == null ? null : daily.worstPrecipitationType().getDisplayName())
            .maxPrecipitationProbability(daily.maxPrecipitationProbability())
            .minTemperature(daily.minTemperature())
            .maxTemperature(daily.maxTemperature())
            .maxWindSpeed(daily.maxWindSpeed())
            .build();
    }

    /**
     * 특보 한 건을 내부 응답으로. enum 은 code/name/description 을 펴서 준다 — metadata 타입을
     * 그대로 실으면 이 서비스의 표현 타입이 서비스 경계를 넘는다.
     *
     * <p>{@code recommendationSuppressed} 는 {@link WeatherWarning#suppressesRecommendation}
     * 한 곳에서 나온다. 소비 측이 {@code levelCode.equals("WARNING")} 으로 다시 세우면 규칙이
     * 두 곳으로 갈라진다 (#357).
     */
    public WeatherWarningInternalResponse toWeatherWarningResponse(WeatherWarning warning) {
        return WeatherWarningInternalResponse.builder()
            .typeCode(warning.type().name())
            .typeName(warning.type().getDisplayName())
            .typeDescription(warning.type().getDescription())
            .levelCode(warning.level().name())
            .levelName(warning.level().getDisplayName())
            .levelDescription(warning.level().getDescription())
            .recommendationSuppressed(WeatherWarning.suppressesRecommendation(warning))
            .effectiveAt(warning.effectiveAt())
            .build();
    }
}

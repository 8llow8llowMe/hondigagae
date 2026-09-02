package com.hondigagae.domainlayer.insight.adapter.in.internal.presenter;

import com.hondigagae.domainlayer.insight.adapter.in.internal.dto.DailyWeatherInternalResponse;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
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
}

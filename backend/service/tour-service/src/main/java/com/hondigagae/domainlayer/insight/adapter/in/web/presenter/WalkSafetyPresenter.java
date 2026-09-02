package com.hondigagae.domainlayer.insight.adapter.in.web.presenter;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.WalkSafetyReasonItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.WalkSafetyResponse;
import com.hondigagae.domainlayer.insight.application.info.WalkSafetyInfo;
import com.hondigagae.domainlayer.insight.domain.model.WalkSafetyAssessment;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WalkSafetyPresenter {

    private final InsightPresenter insightPresenter;

    public WalkSafetyResponse toResponse(WalkSafetyInfo info) {
        WalkSafetyAssessment assessment = info.assessment();
        WeatherForecast forecast = info.forecast();

        return WalkSafetyResponse.builder()
            .placeId(String.valueOf(info.placeId()))
            .placeTitle(info.placeTitle())
            .targetDateTime(info.targetDateTime())
            .walkSafetyLevel(assessment.level().toScoreMetadata())
            .reasons(toReasonItems(assessment))
            .weatherWarning(insightPresenter.toWarningItem(info.weatherWarning()))
            .estimatedPavementCelsius(assessment.estimatedPavementCelsius())
            .heatIndexCelsius(assessment.heatIndexCelsius())
            .saferWindowStart(assessment.saferWindowStart())
            .saferWindowEnd(assessment.saferWindowEnd())
            .temperature(forecast == null ? null : forecast.temperature())
            .humidity(forecast == null ? null : forecast.humidity())
            .skyState(forecast == null || forecast.skyState() == null ? null : forecast.skyState().toMetadata())
            .precipitationType(forecast == null || forecast.precipitationType() == null
                ? null : forecast.precipitationType().toMetadata())
            .petConditionApplied(info.petConditionApplied())
            .weatherProviderName(InsightPresenter.WEATHER_PROVIDER_NAME)
            .build();
    }

    private List<WalkSafetyReasonItem> toReasonItems(WalkSafetyAssessment assessment) {
        if (assessment.reasons() == null) {
            return List.of();
        }
        return assessment.reasons().stream()
            .map(reason -> WalkSafetyReasonItem.builder()
                .code(reason.code().name())
                .name(reason.code().getDisplayName())
                .description(reason.description())
                .build())
            .toList();
    }
}

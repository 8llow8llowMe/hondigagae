package com.hondigagae.domainlayer.insight.adapter.in.web.presenter;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.PlaceSuitabilityResponse;
import com.hondigagae.domainlayer.insight.application.info.PlaceSuitabilityInfo;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityScore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlaceSuitabilityPresenter {

    private final InsightPresenter insightPresenter;

    public PlaceSuitabilityResponse toResponse(PlaceSuitabilityInfo info) {
        SuitabilityScore score = info.score();

        return PlaceSuitabilityResponse.builder()
            .placeId(String.valueOf(info.placeId()))
            .placeTitle(info.placeTitle())
            .targetDate(info.targetDate())
            // 점수를 못 낸 경우 null 을 그대로 내린다. 0 으로 바꾸면 "최악"으로 읽힌다.
            .score(score.score())
            .suitabilityLevel(score.level().toScoreMetadata())
            .reasons(insightPresenter.toReasonItems(score.reasons()))
            .weatherWarning(insightPresenter.toWarningItem(info.weatherWarning()))
            .weather(insightPresenter.toWeatherItem(info.weather()))
            .congestion(insightPresenter.toCongestionItem(info.congestion()))
            .indoorAlternatives(insightPresenter.toAlternativeItems(info.indoorAlternatives()))
            .petConditionApplied(info.petConditionApplied())
            .weatherApplied(score.weatherApplied())
            .congestionApplied(score.congestionApplied())
            .weatherProviderName(InsightPresenter.WEATHER_PROVIDER_NAME)
            .build();
    }
}

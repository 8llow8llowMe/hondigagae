package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanAlternativePlaceItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanDailyWeatherItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanDayWeatherItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanWeatherReasonItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanWeatherResponse;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo.PlanDayWeatherInfo;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceSuitabilityQueryResult;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class PlanWeatherPresenter {

    public PlanWeatherResponse toResponse(PlanWeatherInfo info) {
        return PlanWeatherResponse.builder()
            .planId(String.valueOf(info.planId()))
            .planTitle(info.planTitle())
            .startDate(info.startDate())
            .endDate(info.endDate())
            .petConditionApplied(info.petConditionApplied())
            .days(info.days().stream().map(this::toDayItem).toList())
            .build();
    }

    private PlanDayWeatherItem toDayItem(PlanDayWeatherInfo day) {
        PlaceSuitabilityQueryResult suitability = day.suitability();

        return PlanDayWeatherItem.builder()
            .day(day.day())
            .date(day.date())
            .representativePlaceId(day.representativePlaceId() == null
                ? null : String.valueOf(day.representativePlaceId()))
            .representativePlaceTitle(day.representativePlaceTitle())
            // 점수를 못 낸 날은 null 을 그대로 내린다. 0 으로 바꾸면 "최악"으로 읽힌다.
            .score(suitability == null ? null : suitability.score())
            .suitabilityLevel(toLevelMetadata(suitability))
            .reasons(toReasonItems(suitability))
            .weather(toWeatherItem(suitability))
            .indoorAlternatives(toAlternativeItems(suitability))
            .unavailableReason(day.unavailableReason())
            .build();
    }

    private ScoreMetricMetadata toLevelMetadata(PlaceSuitabilityQueryResult suitability) {
        if (suitability == null || suitability.levelCode() == null) {
            return null;
        }
        return ScoreMetricMetadata.of(
            suitability.levelCode(), suitability.levelName(), suitability.levelDescription(), null);
    }

    private List<PlanWeatherReasonItem> toReasonItems(PlaceSuitabilityQueryResult suitability) {
        if (suitability == null || suitability.reasons() == null) {
            return List.of();
        }
        return suitability.reasons().stream()
            .map(reason -> PlanWeatherReasonItem.builder()
                .code(reason.code())
                .name(reason.name())
                .description(reason.description())
                .scoreDelta(reason.scoreDelta())
                .build())
            .toList();
    }

    private PlanDailyWeatherItem toWeatherItem(PlaceSuitabilityQueryResult suitability) {
        if (suitability == null || suitability.weather() == null) {
            return null;
        }
        PlaceSuitabilityQueryResult.DailyWeatherQueryResult weather = suitability.weather();
        return PlanDailyWeatherItem.builder()
            .date(weather.date())
            .minTemperature(weather.minTemperature())
            .maxTemperature(weather.maxTemperature())
            .maxPrecipitationProbability(weather.maxPrecipitationProbability())
            .precipitationTypeName(weather.precipitationTypeName())
            .skyStateName(weather.skyStateName())
            .maxWindSpeed(weather.maxWindSpeed())
            .maxHumidity(weather.maxHumidity())
            .build();
    }

    private List<PlanAlternativePlaceItem> toAlternativeItems(PlaceSuitabilityQueryResult suitability) {
        if (suitability == null || suitability.indoorAlternatives() == null) {
            return List.of();
        }
        return suitability.indoorAlternatives().stream()
            .map(alternative -> PlanAlternativePlaceItem.builder()
                .placeId(String.valueOf(alternative.placeId()))
                .title(alternative.title())
                .lat(alternative.lat())
                .lng(alternative.lng())
                .distanceMeters(alternative.distanceMeters())
                .build())
            .toList();
    }
}

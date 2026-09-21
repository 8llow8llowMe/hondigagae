package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanAlternativePlaceItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanDailyWeatherItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanDayPetSuitabilityItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanDayWeatherItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanWeatherReasonItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanWeatherResponse;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo.PlanDayWeatherInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanDaySuitabilityInfo;
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
            .petIds(info.petIds() == null ? List.of() : info.petIds().stream().map(String::valueOf).toList())
            .petConditionApplied(info.petConditionApplied())
            .days(info.days().stream().map(this::toDayItem).toList())
            .build();
    }

    /** 하루치 항목. 여행 브리핑이 같은 DTO 를 내려 두 화면이 같은 컴포넌트를 쓰게 하기 위해 공개했다. */
    public PlanDayWeatherItem toDayItem(PlanDayWeatherInfo day) {
        PlanDaySuitabilityInfo suitability = day.suitability();

        return PlanDayWeatherItem.builder()
            .day(day.day())
            .date(day.date())
            .representativePlaceId(day.representativePlaceId() == null
                ? null : String.valueOf(day.representativePlaceId()))
            .representativePlaceTitle(day.representativePlaceTitle())
            .basisPetId(day.basisPetId() == null ? null : String.valueOf(day.basisPetId()))
            // 점수를 못 낸 날은 null 을 그대로 내린다. 0 으로 바꾸면 "최악"으로 읽힌다.
            .score(suitability == null ? null : suitability.score())
            .suitabilityLevel(suitability == null ? null
                : toLevelMetadata(suitability.levelCode(), suitability.levelName(),
                    suitability.levelDescription(), suitability.levelScoreDescription()))
            .reasons(toReasonItems(suitability))
            .weather(toWeatherItem(suitability))
            .indoorAlternatives(toAlternativeItems(suitability))
            .petSuitabilities(toPetSuitabilityItems(day))
            // 코드와 문장을 함께 내린다. 문장만 주면 프론트가 사유별로 다르게 그릴 수 없고,
            // 코드만 주면 문구가 둘로 갈린다 (#492 / #497).
            .unavailableReasonCode(day.unavailableReason() == null ? null : day.unavailableReason().name())
            .unavailableReason(day.unavailableReason() == null ? null : day.unavailableReason().getDescription())
            .build();
    }

    private List<PlanDayPetSuitabilityItem> toPetSuitabilityItems(PlanDayWeatherInfo day) {
        if (day.petSuitabilities() == null) {
            return List.of();
        }
        return day.petSuitabilities().stream()
            .map(pet -> PlanDayPetSuitabilityItem.builder()
                .petId(String.valueOf(pet.petId()))
                .score(pet.score())
                .suitabilityLevel(toLevelMetadata(pet.levelCode(), pet.levelName(),
                    pet.levelDescription(), pet.levelScoreDescription()))
                .build())
            .toList();
    }

    /**
     * 등급 metadata. <b>{@code scoreDescription} 까지 내린다</b> — 원천({@code SuitabilityLevel})이
     * 네 칸을 모두 채워 보내는데 여기서 {@code null} 로 접고 있었다 (#759). 등급 설명과 달리
     * 점수를 어떻게 읽어야 하는지를 말하는 문장이라, 화면이 점수 옆에 그대로 쓸 수 있다.
     */
    private ScoreMetricMetadata toLevelMetadata(
        String levelCode, String levelName, String levelDescription, String levelScoreDescription
    ) {
        if (levelCode == null) {
            return null;
        }
        return ScoreMetricMetadata.of(levelCode, levelName, levelDescription, levelScoreDescription);
    }

    private List<PlanWeatherReasonItem> toReasonItems(PlanDaySuitabilityInfo suitability) {
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

    private PlanDailyWeatherItem toWeatherItem(PlanDaySuitabilityInfo suitability) {
        if (suitability == null || suitability.weather() == null) {
            return null;
        }
        PlanDaySuitabilityInfo.DailyWeatherInfo weather = suitability.weather();
        return PlanDailyWeatherItem.builder()
            .date(weather.date())
            .forecastSourceCode(weather.forecastSourceCode())
            .forecastSourceName(weather.forecastSourceName())
            .minTemperature(weather.minTemperature())
            .maxTemperature(weather.maxTemperature())
            .maxPrecipitationProbability(weather.maxPrecipitationProbability())
            .precipitationTypeName(weather.precipitationTypeName())
            .skyStateName(weather.skyStateName())
            .maxWindSpeed(weather.maxWindSpeed())
            .maxHumidity(weather.maxHumidity())
            .maxFeelsLikeTemperature(weather.maxFeelsLikeTemperature())
            .build();
    }

    private List<PlanAlternativePlaceItem> toAlternativeItems(PlanDaySuitabilityInfo suitability) {
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

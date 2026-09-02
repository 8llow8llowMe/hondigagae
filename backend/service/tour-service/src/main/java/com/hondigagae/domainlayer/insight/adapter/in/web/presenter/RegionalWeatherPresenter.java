package com.hondigagae.domainlayer.insight.adapter.in.web.presenter;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.RegionWeatherItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.RegionalWeatherResponse;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.RegionWeather;
import com.hondigagae.domainlayer.insight.domain.model.RegionalWeatherComparison;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityReason;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RegionalWeatherPresenter {

    private final InsightPresenter insightPresenter;

    public RegionalWeatherResponse toResponse(RegionalWeatherComparison comparison) {
        RegionWeather recommended = comparison.recommended();

        return RegionalWeatherResponse.builder()
            .date(comparison.date())
            .regions(comparison.regions().stream().map(this::toItem).toList())
            .recommendedRegion(recommended == null ? null : recommended.region().toMetadata())
            .recommendationReasons(toRecommendationReasons(recommended))
            .weatherWarning(insightPresenter.toWarningItem(comparison.weatherWarning()))
            .build();
    }

    /**
     * 추천 이유는 그 권역의 판정 근거를 그대로 옮긴다.
     *
     * <p>따로 문장을 짓지 않는 것이 요점이다. "남부가 가장 좋습니다" 같은 문장은 데이터가 아니라
     * 결론이고, 사용자가 검증할 수 없다. 점수를 만든 근거를 그대로 보여 주면 왜 그 권역인지
     * 스스로 판단할 수 있다 (api-design-guide §9).
     */
    private List<String> toRecommendationReasons(RegionWeather recommended) {
        if (recommended == null || recommended.reasons() == null) {
            return List.of();
        }
        return recommended.reasons().stream().map(SuitabilityReason::description).toList();
    }

    private RegionWeatherItem toItem(RegionWeather region) {
        DailyWeather weather = region.weather();
        return RegionWeatherItem.builder()
            .region(region.region().toMetadata())
            .weatherScore(region.weatherScore())
            .skyState(weather == null || weather.representativeSkyState() == null
                ? null : weather.representativeSkyState().toMetadata())
            .precipitationType(weather == null || weather.worstPrecipitationType() == null
                ? null : weather.worstPrecipitationType().toMetadata())
            .maxPrecipitationProbability(weather == null ? null : weather.maxPrecipitationProbability())
            .minTemperature(weather == null ? null : weather.minTemperature())
            .maxTemperature(weather == null ? null : weather.maxTemperature())
            .maxWindSpeed(weather == null ? null : weather.maxWindSpeed())
            .reasons(insightPresenter.toReasonItems(region.reasons()))
            .build();
    }
}

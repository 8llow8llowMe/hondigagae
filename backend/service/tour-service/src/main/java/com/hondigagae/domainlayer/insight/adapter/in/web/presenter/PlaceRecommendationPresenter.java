package com.hondigagae.domainlayer.insight.adapter.in.web.presenter;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.PlaceRecommendationItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.PlaceRecommendationResponse;
import com.hondigagae.domainlayer.insight.application.info.PlaceRecommendationInfo;
import com.hondigagae.domainlayer.insight.application.info.RecommendedPlaceInfo;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityScore;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 장소 추천 응답 변환 (#1368). 판정 조각은 적합도 응답과 같은 {@link InsightPresenter} 로 만든다 — 같은 날씨 · 같은 근거가
 * 응답마다 다른 모양으로 나가지 않게 한다.
 */
@Component
@RequiredArgsConstructor
public class PlaceRecommendationPresenter {

    private final InsightPresenter insightPresenter;

    public PlaceRecommendationResponse toResponse(PlaceRecommendationInfo info) {
        return PlaceRecommendationResponse.builder()
            .targetDate(info.targetDate())
            .weatherProviderName(InsightPresenter.WEATHER_PROVIDER_NAME)
            .weatherWarning(insightPresenter.toWarningItem(info.weatherWarning()))
            .items(info.places().stream().map(this::toItem).toList())
            .build();
    }

    private PlaceRecommendationItem toItem(RecommendedPlaceInfo place) {
        SuitabilityScore score = place.score();

        return PlaceRecommendationItem.builder()
            .placeId(String.valueOf(place.placeId()))
            .contentType(ContentType.fromCode(place.contentTypeId()).toMetadata())
            .title(place.title())
            .addr1(place.addr1())
            .sigunguCode(place.sigunguCode())
            .lat(place.lat())
            .lng(place.lng())
            .firstImage(place.firstImage())
            .firstImage2(place.firstImage2())
            .petAllowanceType(place.petAllowanceType().toMetadata())
            .maxPetWeightKg(place.maxPetWeightKg())
            .indoor(place.indoor())
            .score(score.score())
            .suitabilityLevel(score.level().toScoreMetadata())
            .headline(place.headline())
            .reasons(insightPresenter.toReasonItems(score.reasons()))
            .weather(insightPresenter.toWeatherItem(place.weather()))
            .congestion(insightPresenter.toCongestionItem(place.congestion()))
            .indoorAlternatives(insightPresenter.toAlternativeItems(place.indoorAlternatives()))
            .petConditionApplied(place.petConditionApplied())
            .weatherApplied(score.weatherApplied())
            .congestionApplied(score.congestionApplied())
            .build();
    }
}

package com.hondigagae.domainlayer.insight.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.AlternativePlaceItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.CongestionItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.DailyWeatherItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.SuitabilityReasonItem;
import com.hondigagae.domainlayer.insight.application.info.AlternativePlaceInfo;
import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityReason;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * insight 응답 조각 변환. 적합도/위험도/일정 브리핑이 같은 조각을 공유하므로 한곳에 모은다.
 *
 * <p>Presenter 가 여럿으로 갈라지면 같은 날씨가 응답마다 다른 모양으로 나가고, 프론트가
 * 화면마다 다른 파서를 갖게 된다.
 */
@Component
public class InsightPresenter {

    public static final String WEATHER_PROVIDER_NAME = "기상청 단기예보";
    public static final String CONGESTION_PROVIDER_NAME = "한국관광공사 관광지 집중률 방문자 추이 예측";

    public List<SuitabilityReasonItem> toReasonItems(List<SuitabilityReason> reasons) {
        if (reasons == null) {
            return List.of();
        }
        return reasons.stream()
            .map(reason -> SuitabilityReasonItem.builder()
                .code(reason.code().name())
                .name(reason.code().getDisplayName())
                .description(reason.description())
                .scoreDelta(reason.scoreDelta())
                .build())
            .toList();
    }

    /** 예보가 없으면 null 을 그대로 돌려준다. 빈 객체를 만들면 화면이 0도로 읽는다. */
    public DailyWeatherItem toWeatherItem(DailyWeather weather) {
        if (weather == null) {
            return null;
        }
        return DailyWeatherItem.builder()
            .date(weather.date())
            // 같은 점수라도 단기/중기는 신뢰도가 다르다. 출처를 감추지 않는다.
            .forecastSource(weather.source() == null ? null : weather.source().toMetadata())
            .minTemperature(weather.minTemperature())
            .maxTemperature(weather.maxTemperature())
            .maxPrecipitationProbability(weather.maxPrecipitationProbability())
            .precipitationType(weather.worstPrecipitationType() == null
                ? null : weather.worstPrecipitationType().toMetadata())
            .skyState(weather.representativeSkyState() == null
                ? null : weather.representativeSkyState().toMetadata())
            .maxWindSpeed(weather.maxWindSpeed())
            .maxHumidity(weather.maxHumidity())
            .totalPrecipitationMm(weather.totalPrecipitationMm())
            .build();
    }

    public CongestionItem toCongestionItem(CongestionSnapshot congestion) {
        if (congestion == null) {
            return null;
        }
        return CongestionItem.builder()
            .level(congestion.level().toMetadata())
            // 등급이 UNKNOWN 이면 수치도 내리지 않는다. 없는 값을 0 으로 보이게 하지 않기 위해서다.
            .concentrationRate(congestion.isKnown() ? congestion.concentrationRate() : null)
            .build();
    }

    public List<AlternativePlaceItem> toAlternativeItems(List<AlternativePlaceInfo> alternatives) {
        if (alternatives == null) {
            return List.of();
        }
        return alternatives.stream()
            .map(alternative -> AlternativePlaceItem.builder()
                .placeId(String.valueOf(alternative.placeId()))
                .title(alternative.title())
                .lat(alternative.lat())
                .lng(alternative.lng())
                .distanceMeters(alternative.distanceMeters())
                .petAllowanceType(toMetadata(alternative.petAllowanceType()))
                .allowedPetSize(toMetadata(alternative.allowedPetSize()))
                .build())
            .toList();
    }

    private CodeNameDescriptionMetadata toMetadata(CodeNameDescribable describable) {
        return describable == null ? null : describable.toMetadata();
    }
}

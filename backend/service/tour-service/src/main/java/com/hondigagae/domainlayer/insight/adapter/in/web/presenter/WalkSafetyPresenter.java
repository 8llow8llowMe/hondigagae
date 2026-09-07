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

    /** 계산 근거를 응답에 그대로 싣는다 — 사용자가 기상청 앱 값과 비교할 때 왜 같은지/다른지 알 수 있어야 한다. */
    private static final String FEELS_LIKE_BASIS =
        "기상청 여름철 체감온도 산식으로 계산했습니다. 판정 시각의 기온과 상대습도로 습구온도(Stull, 2011 근사식)를 구해 산출하며, "
            + "폭염특보 기준(주의보 33℃·경보 35℃)과 같은 척도입니다. 습도가 없는 시각은 기온을 그대로 씁니다.";
    private static final String HEAT_INDEX_BASIS =
        "미국 NOAA 열지수(Rothfusz 회귀식 섭씨판)로 계산한 참고값입니다. 판정에는 쓰지 않으며, "
            + "고온다습에서 기상청 체감온도보다 높게 나오는 별도 지표입니다.";

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
            .feelsLikeCelsius(assessment.feelsLikeCelsius())
            .feelsLikeBasis(assessment.feelsLikeCelsius() == null ? null : FEELS_LIKE_BASIS)
            .heatIndexCelsius(assessment.heatIndexCelsius())
            .heatIndexBasis(assessment.heatIndexCelsius() == null ? null : HEAT_INDEX_BASIS)
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

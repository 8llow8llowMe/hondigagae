package com.hondigagae.domainlayer.insight.adapter.in.web.presenter;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.HourlyWalkSafetyItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.WalkTimesResponse;
import com.hondigagae.domainlayer.insight.application.info.WalkTimesInfo;
import com.hondigagae.domainlayer.insight.domain.model.GoldenWalkWindow;
import com.hondigagae.domainlayer.insight.domain.model.HourlyWalkSafety;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WalkTimesPresenter {

    private final InsightPresenter insightPresenter;

    public WalkTimesResponse toResponse(WalkTimesInfo info) {
        GoldenWalkWindow golden = info.goldenWindow();

        return WalkTimesResponse.builder()
            .from(info.from())
            .hourly(info.curve().stream().map(this::toItem).toList())
            .forecastCoverage(info.forecastCoverage().toMetadata())
            .goldenStart(golden == null ? null : golden.start())
            .goldenEnd(golden == null ? null : golden.end())
            .goldenLevel(golden == null ? null : golden.level().toScoreMetadata())
            .goldenWindowStatus(info.goldenWindowStatus().toMetadata())
            .weatherWarning(insightPresenter.toWarningItem(info.weatherWarning()))
            .petConditionApplied(info.petConditionApplied())
            .build();
    }

    private HourlyWalkSafetyItem toItem(HourlyWalkSafety point) {
        return HourlyWalkSafetyItem.builder()
            .at(point.at())
            .walkSafetyLevel(point.level().toScoreMetadata())
            .temperature(point.temperature())
            .estimatedPavementCelsius(point.estimatedPavementCelsius())
            .precipitationProbability(point.precipitationProbability())
            .build();
    }
}

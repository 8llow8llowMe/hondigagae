package com.hondigagae.domainlayer.insight.application.service.processor;

import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.info.WalkSafetyInfo;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.application.model.PlaceInsightQuery;
import com.hondigagae.domainlayer.insight.application.port.out.PlaceProfileQueryPort;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.domainlayer.insight.domain.model.PlaceCondition;
import com.hondigagae.domainlayer.insight.domain.model.WalkSafetyAssessment;
import com.hondigagae.domainlayer.insight.domain.model.WalkSafetyEvaluator;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import com.hondigagae.global.properties.InsightProperties;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 장소 산책 위험도 산출.
 *
 * <p>적합도가 <b>하루</b>를 보는 것과 달리 위험도는 <b>시각</b>을 본다. 같은 날 안에서도
 * 14시와 19시의 노면온도는 완전히 다르고, 그 차이가 이 기능의 전부이기 때문이다.
 *
 * <p>적합도와 같은 이유로 트랜잭션을 걸지 않는다 (architecture-guide §3 의 문서화된 예외).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WalkSafetyProcessor {

    /** 이 시간보다 먼 예보는 "그 시각의 날씨"로 보지 않는다. */
    private static final Duration MAX_FORECAST_GAP = Duration.ofHours(3);

    private final PlaceProfileQueryPort placeProfileQueryPort;
    private final WeatherForecastProcessor weatherForecastProcessor;
    private final InsightMapper insightMapper;
    private final InsightProperties insightProperties;
    private final WeatherWarningProcessor weatherWarningProcessor;

    public WalkSafetyInfo assess(PlaceInsightQuery query) {
        PlaceCondition place = placeProfileQueryPort.findProfile(query.placeId())
            .orElseThrow(() -> new InsightException(InsightErrorCode.NOT_FOUND_PLACE));
        if (!place.hasCoordinate()) {
            throw new InsightException(InsightErrorCode.PLACE_COORDINATE_MISSING);
        }

        LocalDateTime target = query.resolvedDateTime();
        List<WeatherForecast> forecasts = loadForecasts(place, target);
        List<WeatherForecast> sameDay = forecasts.stream()
            .filter(forecast -> forecast.forecastAt().toLocalDate().equals(target.toLocalDate()))
            .toList();
        WeatherForecast nearest = nearest(sameDay, target).orElse(null);
        // 판정과 응답이 같은 값을 쓰도록 한 번만 구한다.
        WeatherWarning warning = isToday(target) ? weatherWarningProcessor.heaviestWarning().orElse(null) : null;

        WalkSafetyAssessment assessment = WalkSafetyEvaluator.evaluate(
            nearest, sameDay, query.petCondition(), insightMapper.toThresholds(insightProperties), target,
            // 예보는 받았는데 그 시각이 없으면 범위 밖(정상), 목록 자체가 없으면 장애다.
            !forecasts.isEmpty() && sameDay.isEmpty(), warning);

        return WalkSafetyInfo.builder()
            .placeId(place.placeId())
            .placeTitle(place.title())
            .targetDateTime(target)
            .assessment(assessment)
            .forecast(nearest)
            .weatherWarning(warning)
            .petConditionApplied(query.petCondition().isSpecified())
            .build();
    }

    private List<WeatherForecast> loadForecasts(PlaceCondition place, LocalDateTime target) {
        try {
            return weatherForecastProcessor.forecastsAt(place.lat(), place.lng());
        } catch (InsightException exception) {
            log.info("Walk safety falls back to no-weather placeId={} at={} errorCode={}",
                place.placeId(), target, exception.getErrorCode().getCode());
            return List.of();
        }
    }

    /**
     * 기준 시각에 가장 가까운 예보. 너무 먼 것은 쓰지 않는다.
     *
     * <p>단기예보는 시간 단위라 보통 한 시간 안쪽에서 찾힌다. 세 시간을 넘는다면 그 시각의
     * 예보가 사실상 없는 것이고, 그것을 "가장 가까운 값"이라며 쓰면 새벽 기온으로 한낮 노면을
     * 판정하는 일이 생긴다.
     */
    private Optional<WeatherForecast> nearest(List<WeatherForecast> forecasts, LocalDateTime target) {
        return forecasts.stream()
            .min(Comparator.comparingLong(forecast -> gapMinutes(forecast, target)))
            .filter(forecast -> gapMinutes(forecast, target) <= MAX_FORECAST_GAP.toMinutes());
    }

    private long gapMinutes(WeatherForecast forecast, LocalDateTime target) {
        return Math.abs(Duration.between(target, forecast.forecastAt()).toMinutes());
    }

    /** 특보는 지금 발효 중인 것이라 오늘에만 붙인다. */
    private boolean isToday(LocalDateTime target) {
        return target.toLocalDate().equals(LocalDate.now());
    }
}

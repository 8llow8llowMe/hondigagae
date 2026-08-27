package com.hondigagae.domainlayer.insight.application.service.processor;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.insight.application.exception.InsightErrorCode;
import com.hondigagae.domainlayer.insight.application.exception.InsightException;
import com.hondigagae.domainlayer.insight.application.info.AlternativePlaceInfo;
import com.hondigagae.domainlayer.insight.application.info.PlaceSuitabilityInfo;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.application.model.AlternativePlaceCriteria;
import com.hondigagae.domainlayer.insight.application.model.PlaceInsightQuery;
import com.hondigagae.domainlayer.insight.application.port.out.CongestionForecastPort;
import com.hondigagae.domainlayer.insight.application.port.out.PlaceProfileQueryPort;
import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.PlaceCondition;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityEvaluator;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityInput;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityScore;
import com.hondigagae.global.properties.InsightProperties;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 장소 여행 적합도 산출.
 *
 * <p>포트에서 근거를 모으고, 점수 계산 자체는 도메인({@link SuitabilityEvaluator})에 맡긴다.
 * 여기서 하는 일은 <b>무엇을 근거로 삼을 수 있는지 판단</b>하는 것이다 - 예보가 닿는 날짜인지,
 * 혼잡도가 연결돼 있는지, 좌표가 있는지.
 *
 * <p><b>트랜잭션을 걸지 않는다.</b> DB 조회(장소) - 원격 호출(기상청) - DB 조회(혼잡도)가
 * 번갈아 일어나므로, 이 메서드에 트랜잭션을 걸면 커넥션을 잡은 채 기상청 응답을 기다리게 된다
 * (architecture-guide §3 의 문서화된 예외). 각 조회는 단건이라 스냅샷 일관성이 필요하지 않다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceSuitabilityProcessor {

    private final PlaceProfileQueryPort placeProfileQueryPort;
    private final CongestionForecastPort congestionForecastPort;
    private final WeatherForecastProcessor weatherForecastProcessor;
    private final InsightMapper insightMapper;
    private final InsightProperties insightProperties;

    public PlaceSuitabilityInfo evaluate(PlaceInsightQuery query) {
        PlaceCondition place = placeProfileQueryPort.findProfile(query.placeId())
            .orElseThrow(() -> new InsightException(InsightErrorCode.NOT_FOUND_PLACE));
        if (!place.hasCoordinate()) {
            // 좌표 없이는 격자를 못 구해 날씨를 붙일 수 없다. 조용히 빈 점수를 주는 대신 명시한다.
            throw new InsightException(InsightErrorCode.PLACE_COORDINATE_MISSING);
        }

        LocalDate targetDate = query.resolvedDate();
        WeatherLookup weather = lookupWeather(place, targetDate);
        CongestionSnapshot congestion = congestionForecastPort.findByPlaceAndDate(query.placeId(), targetDate);

        SuitabilityScore score = SuitabilityEvaluator.evaluate(SuitabilityInput.builder()
            .place(place)
            .pet(query.petCondition())
            .weather(weather.daily())
            .forecastOutOfRange(weather.outOfRange())
            .congestion(congestion)
            .thresholds(insightMapper.toThresholds(insightProperties))
            .build());

        return PlaceSuitabilityInfo.builder()
            .placeId(place.placeId())
            .placeTitle(place.title())
            .targetDate(targetDate)
            .score(score)
            .weather(weather.daily())
            .congestion(congestion)
            .indoorAlternatives(findIndoorAlternativesIfRainy(place, weather.daily()))
            .petConditionApplied(query.petCondition().isSpecified())
            .build();
    }

    /**
     * 그 날짜의 예보를 찾고, 없으면 <b>왜 없는지</b>까지 판단한다.
     *
     * <p>예보 목록이 돌아왔는데 그 날짜만 없다면 범위 밖(정상)이고, 목록 자체를 못 받았다면
     * 장애다. 사용자에게 할 말이 다르므로 여기서 구분한다.
     */
    private WeatherLookup lookupWeather(PlaceCondition place, LocalDate targetDate) {
        try {
            List<DailyWeather> dailies = weatherForecastProcessor.dailyForecastsAt(place.lat(), place.lng());
            Optional<DailyWeather> matched = DailyWeather.findByDate(dailies, targetDate);
            if (matched.isPresent()) {
                return new WeatherLookup(matched.get(), false);
            }
            return new WeatherLookup(null, !dailies.isEmpty());
        } catch (InsightException exception) {
            log.info("Suitability falls back to no-weather placeId={} date={} errorCode={}",
                place.placeId(), targetDate, exception.getErrorCode().getCode());
            return new WeatherLookup(null, false);
        }
    }

    /**
     * 비 예보가 있고 이 장소에 실내 공간이 없을 때만 대안을 찾는다.
     *
     * <p>실내가 있는 장소에 실내 대안을 붙이면 소음이다. 비가 안 오는 날도 마찬가지다.
     */
    private List<AlternativePlaceInfo> findIndoorAlternativesIfRainy(PlaceCondition place, DailyWeather weather) {
        if (weather == null || place.hasIndoorShelter()) {
            return List.of();
        }
        Integer rainChance = weather.maxPrecipitationProbability();
        boolean rainy = (rainChance != null && rainChance >= insightProperties.rainProbabilityPercent())
            || (weather.worstPrecipitationType() != null && weather.worstPrecipitationType().isWet());
        if (!rainy) {
            return List.of();
        }

        AlternativePlaceCriteria criteria = AlternativePlaceCriteria.builder()
            .lat(place.lat())
            .lng(place.lng())
            .radiusMeters(insightProperties.alternativeRadiusMeters())
            .excludePlaceId(place.placeId())
            .size(insightProperties.alternativeSize())
            .build();

        return placeProfileQueryPort.findIndoorAlternatives(criteria).stream()
            .map(candidate -> toAlternativeInfo(place, candidate))
            .toList();
    }

    private AlternativePlaceInfo toAlternativeInfo(PlaceCondition origin, PlaceCondition candidate) {
        double distance = GeoDistance.meters(origin.lat(), origin.lng(), candidate.lat(), candidate.lng());
        return AlternativePlaceInfo.builder()
            .placeId(candidate.placeId())
            .title(candidate.title())
            .lat(candidate.lat())
            .lng(candidate.lng())
            .distanceMeters((int) Math.round(distance))
            .petAllowanceType(candidate.petAllowanceType())
            .allowedPetSize(candidate.allowedPetSize())
            .build();
    }

    /**
     * 예보 조회 결과. 없을 때 그 이유를 함께 들고 다니기 위한 내부 값이다.
     *
     * @param outOfRange 예보 자체는 받았는데 그 날짜가 범위 밖이면 true (장애가 아니라 정상)
     */
    private record WeatherLookup(DailyWeather daily, boolean outOfRange) {

    }
}

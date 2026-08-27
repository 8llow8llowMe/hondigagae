package com.hondigagae.domainlayer.plan.adapter.out.client;

import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PetConditionClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PlaceSuitabilityClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PetConditionClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PlaceSuitabilityClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceSuitabilityQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceSuitabilityQueryResult;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 일정 날씨 브리핑이 쓰는 내부 호출 어댑터.
 *
 * <p>두 포트를 한 어댑터가 구현한다. 대상 서비스는 다르지만 <b>쓰이는 자리가 하나</b>라
 * 응집도가 유지된다 (coding-conventions §12-1).
 *
 * <p><b>실패를 예외로 올리지 않고 빈 값으로 바꾼다.</b> 날씨 브리핑은 부가 정보이고,
 * tour-service 가 흔들렸다고 사용자가 자기 일정을 못 보게 되면 안 된다. 어느 일자가 비었는지는
 * 응답에 드러난다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlanInsightClientAdapter implements PetConditionQueryPort, PlaceSuitabilityQueryPort {

    private static final String AUTH_SERVICE = "auth-service";

    private final PetConditionClient petConditionClient;
    private final PlaceSuitabilityClient placeSuitabilityClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public PetConditionQueryResult findCondition(long memberId, long petId) {
        try {
            PetConditionClientResponse body = internalResponseSupport.requestAndUnwrapOrNull(
                AUTH_SERVICE, () -> petConditionClient.getPetCondition(petId, memberId));
            if (body == null) {
                log.info("Pet condition not found petId={} memberId={}", petId, memberId);
                return PetConditionQueryResult.unknown();
            }
            return PetConditionQueryResult.builder()
                .breed(body.breed())
                .sizeType(body.sizeType())
                .heatSensitive(body.heatSensitive())
                .coldSensitive(body.coldSensitive())
                .noiseSensitive(body.noiseSensitive())
                .activityLevel(body.activityLevel())
                .build();
        } catch (PlanException exception) {
            // 반려견 특성이 없으면 일반 조건으로 판정된다. 브리핑 자체를 막지는 않는다.
            log.warn("Pet condition lookup failed petId={} errorCode={}",
                petId, exception.getErrorCode().getCode());
            return PetConditionQueryResult.unknown();
        }
    }

    @Override
    public Optional<PlaceSuitabilityQueryResult> findSuitability(
        long placeId, LocalDate targetDate, PetConditionQueryResult pet
    ) {
        try {
            PlaceSuitabilityClientResponse body = internalResponseSupport.requestAndUnwrapOrNull(
                InternalResponseSupport.TOUR_SERVICE,
                () -> placeSuitabilityClient.getSuitability(
                    placeId, targetDate, pet.sizeType(),
                    pet.heatSensitive(), pet.coldSensitive(), pet.noiseSensitive(), pet.breed()));
            return Optional.ofNullable(body).map(this::toQueryResult);
        } catch (PlanException exception) {
            log.warn("Suitability lookup failed placeId={} date={} errorCode={}",
                placeId, targetDate, exception.getErrorCode().getCode());
            return Optional.empty();
        }
    }

    private PlaceSuitabilityQueryResult toQueryResult(PlaceSuitabilityClientResponse body) {
        return PlaceSuitabilityQueryResult.builder()
            .placeId(toPlaceId(body.placeId()))
            .placeTitle(body.placeTitle())
            .targetDate(body.targetDate())
            .score(body.score())
            .levelCode(body.suitabilityLevel() == null ? null : body.suitabilityLevel().code())
            .levelName(body.suitabilityLevel() == null ? null : body.suitabilityLevel().name())
            .levelDescription(body.suitabilityLevel() == null ? null : body.suitabilityLevel().description())
            .reasons(toReasons(body))
            .weather(toWeather(body))
            .indoorAlternatives(toAlternatives(body))
            .weatherApplied(body.weatherApplied())
            .congestionApplied(body.congestionApplied())
            .build();
    }

    private List<PlaceSuitabilityQueryResult.ReasonQueryResult> toReasons(PlaceSuitabilityClientResponse body) {
        if (body.reasons() == null) {
            return List.of();
        }
        return body.reasons().stream()
            .map(reason -> new PlaceSuitabilityQueryResult.ReasonQueryResult(
                reason.code(), reason.name(), reason.description(), reason.scoreDelta()))
            .toList();
    }

    /**
     * 장소 아이디는 정밀도 때문에 문자열로 오간다. 비어 있거나 숫자가 아니면 0 이 아니라 예외다 -
     * 조용히 0번 장소를 가리키게 두면 화면이 엉뚱한 곳으로 이동한다.
     */
    private long toPlaceId(String placeId) {
        try {
            return Long.parseLong(placeId);
        } catch (RuntimeException exception) {
            log.warn("Suitability response carried an unusable placeId={}", placeId);
            throw new PlanException(PlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE, exception);
        }
    }

    private PlaceSuitabilityQueryResult.DailyWeatherQueryResult toWeather(PlaceSuitabilityClientResponse body) {
        PlaceSuitabilityClientResponse.DailyWeatherClientResponse weather = body.weather();
        if (weather == null) {
            return null;
        }
        return new PlaceSuitabilityQueryResult.DailyWeatherQueryResult(
            weather.date(),
            weather.minTemperature(),
            weather.maxTemperature(),
            weather.maxPrecipitationProbability(),
            weather.precipitationType() == null ? null : weather.precipitationType().name(),
            weather.skyState() == null ? null : weather.skyState().name(),
            weather.maxWindSpeed(),
            weather.maxHumidity());
    }

    private List<PlaceSuitabilityQueryResult.AlternativeQueryResult> toAlternatives(
        PlaceSuitabilityClientResponse body
    ) {
        if (body.indoorAlternatives() == null) {
            return List.of();
        }
        return body.indoorAlternatives().stream()
            .filter(alternative -> alternative.placeId() != null && !alternative.placeId().isBlank())
            .map(alternative -> new PlaceSuitabilityQueryResult.AlternativeQueryResult(
                toPlaceId(alternative.placeId()), alternative.title(),
                alternative.lat(), alternative.lng(), alternative.distanceMeters()))
            .toList();
    }
}

package com.hondigagae.domainlayer.plan.adapter.out.client;

import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PetConditionClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PlaceSuitabilityClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PlaceWalkSafetyClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PetConditionClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PlaceSuitabilityClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PlaceWalkSafetyClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceSuitabilityQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceWalkSafetyQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceSuitabilityQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceWalkSafetyQueryResult;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 일정 날씨 브리핑·산책 위험도가 쓰는 내부 호출 어댑터.
 *
 * <p>세 포트를 한 어댑터가 구현한다. 대상 서비스는 다르지만 <b>쓰이는 자리가 하나</b>라
 * 응집도가 유지된다 (coding-conventions §12-1). 세 번째인 {@link PlaceWalkSafetyQueryPort} 도
 * 같은 자리다 — 항목 위험도는 반려견 특성(auth)과 그날 기준 반려견(적합도)을 그대로 이어받아
 * 묻는 것이라, 앞의 둘과 <b>같은 요청 안에서만</b> 불린다.
 *
 * <p><b>실패를 예외로 올리지 않고 빈 값으로 바꾼다.</b> 날씨 브리핑은 부가 정보이고,
 * tour-service 가 흔들렸다고 사용자가 자기 일정을 못 보게 되면 안 된다. 어느 일자가 비었는지는
 * 응답에 드러난다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlanInsightClientAdapter
    implements PetConditionQueryPort, PlaceSuitabilityQueryPort, PlaceWalkSafetyQueryPort {

    private final PetConditionClient petConditionClient;
    private final PlaceSuitabilityClient placeSuitabilityClient;
    private final PlaceWalkSafetyClient placeWalkSafetyClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public Map<Long, PetConditionQueryResult> findConditions(long memberId, List<Long> petIds) {
        if (petIds == null || petIds.isEmpty()) {
            return Map.of();
        }
        try {
            List<PetConditionClientResponse> body = internalResponseSupport.requestAndUnwrapOrNull(
                InternalResponseSupport.AUTH_SERVICE, () -> petConditionClient.getPetConditions(memberId, petIds));
            if (body == null) {
                log.info("Pet conditions not found memberId={} petIds={}", memberId, petIds);
                return Map.of();
            }
            // 응답 순서를 지킨다 — 요청 순서(첫 번째 = 대표 반려견)와 같게 온다.
            Map<Long, PetConditionQueryResult> conditions = new LinkedHashMap<>();
            for (PetConditionClientResponse item : body) {
                Long petId = toPetId(item.petId());
                if (petId != null) {
                    conditions.put(petId, toQueryResult(item));
                }
            }
            return conditions;
        } catch (PlanException exception) {
            // 반려견 특성이 없으면 일반 조건으로 판정된다. 브리핑 자체를 막지는 않는다.
            log.warn("Pet conditions lookup failed memberId={} errorCode={}",
                memberId, exception.getErrorCode().getCode());
            return Map.of();
        }
    }

    @Override
    public Optional<Long> findRepresentativePetId(long memberId) {
        try {
            PetConditionClientResponse body = internalResponseSupport.requestAndUnwrapOrNull(
                InternalResponseSupport.AUTH_SERVICE, () -> petConditionClient.getRepresentativePetCondition(memberId));
            if (body == null) {
                log.info("Representative pet not found memberId={}", memberId);
                return Optional.empty();
            }
            return Optional.ofNullable(toPetId(body.petId()));
        } catch (PlanException exception) {
            log.warn("Representative pet lookup failed memberId={} errorCode={}",
                memberId, exception.getErrorCode().getCode());
            return Optional.empty();
        }
    }

    /**
     * 소유 검증용이라 이 어댑터의 다른 메서드와 달리 <b>실패를 삼키지 않는다</b> — support 가
     * 던지는 503(INTERNAL_SERVICE_UNAVAILABLE)을 그대로 올린다. 포트 계약 참고.
     *
     * <p><b>404 도 실패로 본다.</b> {@code /internal/v1/pets/conditions} 는 소유한 아이가 하나도
     * 없어도 빈 목록을 200 으로 답한다. 그래서 여기서의 404 는 "소유한 아이가 없다" 가 아니라
     * <b>경로가 없다</b>는 뜻이다 — auth-service 가 그 엔드포인트 이전 버전으로 떠 있는 배포
     * 창이다. 그것을 빈 집합으로 접으면 정상 요청이 소유 위반으로 둔갑해 일정 수정은
     * {@code PLAN_011}, 복제는 {@code PLAN_010} 으로 거짓 거절된다.
     */
    @Override
    public Set<Long> findOwnedPetIds(long memberId, List<Long> petIds) {
        List<PetConditionClientResponse> body = internalResponseSupport.requestAndUnwrap(
            InternalResponseSupport.AUTH_SERVICE, () -> petConditionClient.getPetConditions(memberId, petIds));
        if (body == null) {
            return Set.of();
        }
        return body.stream()
            .map(item -> toPetId(item.petId()))
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
    }

    private PetConditionQueryResult toQueryResult(PetConditionClientResponse body) {
        return PetConditionQueryResult.builder()
            .breed(body.breed())
            .sizeType(body.sizeType())
            .heatSensitive(body.heatSensitive())
            .coldSensitive(body.coldSensitive())
            .noiseSensitive(body.noiseSensitive())
            .activityLevel(body.activityLevel())
            .build();
    }

    /** 반려견 아이디는 정밀도 때문에 문자열로 오간다. 못 읽으면 그 행을 버린다 — 0번 반려견을 만들지 않는다. */
    private Long toPetId(String petId) {
        try {
            return Long.parseLong(petId);
        } catch (RuntimeException exception) {
            log.warn("Pet condition response carried an unusable petId={}", petId);
            return null;
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

    /**
     * 항목 시각 기준 산책 위험도. 적합도와 같은 이유로 <b>실패를 빈 값으로 바꾼다</b> —
     * 항목 하나가 비어도 나머지 항목과 일정 자체는 보여 준다.
     */
    @Override
    public Optional<PlaceWalkSafetyQueryResult> findWalkSafety(
        long placeId, LocalDateTime targetDateTime, PetConditionQueryResult pet
    ) {
        try {
            PlaceWalkSafetyClientResponse body = internalResponseSupport.requestAndUnwrapOrNull(
                InternalResponseSupport.TOUR_SERVICE,
                () -> placeWalkSafetyClient.getWalkSafety(
                    placeId, targetDateTime, pet.sizeType(),
                    pet.heatSensitive(), pet.coldSensitive(), pet.noiseSensitive(),
                    pet.activityLevel(), pet.breed()));
            return Optional.ofNullable(body).map(this::toQueryResult);
        } catch (PlanException exception) {
            log.warn("Walk safety lookup failed placeId={} at={} errorCode={}",
                placeId, targetDateTime, exception.getErrorCode().getCode());
            return Optional.empty();
        }
    }

    private PlaceWalkSafetyQueryResult toQueryResult(PlaceWalkSafetyClientResponse body) {
        return PlaceWalkSafetyQueryResult.builder()
            .placeId(toPlaceId(body.placeId()))
            .placeTitle(body.placeTitle())
            .targetDateTime(body.targetDateTime())
            .levelCode(body.walkSafetyLevel() == null ? null : body.walkSafetyLevel().code())
            .levelName(body.walkSafetyLevel() == null ? null : body.walkSafetyLevel().name())
            .levelDescription(body.walkSafetyLevel() == null ? null : body.walkSafetyLevel().description())
            .levelScoreDescription(
                body.walkSafetyLevel() == null ? null : body.walkSafetyLevel().scoreDescription())
            .estimatedPavementCelsius(body.estimatedPavementCelsius())
            .feelsLikeCelsius(body.feelsLikeCelsius())
            .temperature(body.temperature())
            .saferWindowStart(body.saferWindowStart())
            .saferWindowEnd(body.saferWindowEnd())
            .petConditionApplied(body.petConditionApplied())
            .build();
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
     * 장소 아이디는 정밀도 때문에 문자열로 오간다. 비어 있거나 숫자가 아니면 0 으로 접지 않고 예외를
     * 던진다 - 조용히 0번 장소를 가리키게 두면 화면이 엉뚱한 곳으로 이동한다.
     *
     * <p>이 예외는 {@link #findSuitability} 의 catch 에 잡혀 <b>그날 판정이 비는 것</b>으로 끝난다.
     * 틀린 장소를 가리키는 판정보다 없는 판정이 낫다는 같은 이유다. 경고 로그가 남는다.
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
            weather.forecastSource() == null ? null : weather.forecastSource().code(),
            weather.forecastSource() == null ? null : weather.forecastSource().name(),
            weather.minTemperature(),
            weather.maxTemperature(),
            weather.maxPrecipitationProbability(),
            weather.precipitationType() == null ? null : weather.precipitationType().name(),
            weather.skyState() == null ? null : weather.skyState().name(),
            weather.maxWindSpeed(),
            weather.maxHumidity(),
            weather.maxFeelsLikeTemperature());
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

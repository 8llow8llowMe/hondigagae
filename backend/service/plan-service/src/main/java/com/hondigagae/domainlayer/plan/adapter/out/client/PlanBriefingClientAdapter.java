package com.hondigagae.domainlayer.plan.adapter.out.client;

import com.hondigagae.domainlayer.plan.adapter.out.client.feign.InsightBriefingClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.WalkTimesClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.WeatherWarningClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.WalkTimesQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.WeatherWarningQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.WalkTimesQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.WeatherWarningQueryResult;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 여행 브리핑이 쓰는 tour-service 호출 어댑터.
 *
 * <p>두 포트를 한 어댑터가 구현한다. 대상 서비스가 같고 <b>쓰이는 자리가 하나</b>라 응집도가
 * 유지된다 ({@link PlanInsightClientAdapter} 와 같은 판단, coding-conventions §12-1).
 *
 * <p><b>실패 처리가 포트마다 다르다.</b> 골든타임은 실패를 빈 값으로 접고, 특보는 예외를 그대로
 * 올린다 — 특보는 "확인 못 함" 과 "없음" 이 사용자에게 다른 말이라 호출부가 둘을 갈라야 한다.
 * 각 포트의 계약 Javadoc 참고.
 *
 * <p><b>경보 판정(recommendationSuppressed)을 여기서 다시 세우지 않는다.</b> tour-service 가
 * 준 값을 그대로 옮긴다 — 규칙이 두 서비스로 갈라지면 한쪽만 고쳐진다 (#357).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlanBriefingClientAdapter implements WeatherWarningQueryPort, WalkTimesQueryPort {

    private final InsightBriefingClient insightBriefingClient;
    private final InternalResponseSupport internalResponseSupport;

    /**
     * 특보 조회. 실패는 support 가 던지는 {@code PlanException}(503) 을 그대로 올린다 —
     * 삼키면 태풍경보가 떠 있는 날에도 브리핑이 조용해지고, 사용자는 그 침묵을 "특보 없음"
     * 으로 읽는다. tour-service 가 특보를 못 찾은 것(dataBody null)만 empty 다.
     *
     * <p><b>404 도 실패다</b> ({@code requestAndUnwrap}). 이 내부 엔드포인트는 특보가 없어도
     * 200 이라, 404 는 "특보 없음" 이 아니라 tour-service 가 아직 이 경로가 없는 옛 버전이라는
     * 뜻이다. 배포 순서가 어긋난 동안 거짓 "특보 없음" 이 나가지 않게 한다.
     */
    @Override
    public Optional<WeatherWarningQueryResult> findActiveWarning() {
        WeatherWarningClientResponse body = internalResponseSupport.requestAndUnwrap(
            InternalResponseSupport.TOUR_SERVICE, insightBriefingClient::getActiveWeatherWarning);
        return Optional.ofNullable(body).map(this::toQueryResult);
    }

    private WeatherWarningQueryResult toQueryResult(WeatherWarningClientResponse body) {
        return WeatherWarningQueryResult.builder()
            .typeCode(body.typeCode())
            .typeName(body.typeName())
            .typeDescription(body.typeDescription())
            .levelCode(body.levelCode())
            .levelName(body.levelName())
            .levelDescription(body.levelDescription())
            .recommendationSuppressed(body.recommendationSuppressed())
            .effectiveAt(body.effectiveAt())
            .build();
    }

    @Override
    public Optional<WalkTimesQueryResult> findWalkTimes(double lat, double lng, PetConditionQueryResult pet) {
        try {
            WalkTimesClientResponse body = internalResponseSupport.requestAndUnwrapOrNull(
                InternalResponseSupport.TOUR_SERVICE,
                () -> insightBriefingClient.getWalkTimes(
                    lat, lng, pet.sizeType(), pet.heatSensitive(), pet.coldSensitive(),
                    pet.activityLevel(), pet.breed()));
            return Optional.ofNullable(body).map(this::toQueryResult);
        } catch (PlanException exception) {
            log.warn("Walk times lookup failed lat={} lng={} errorCode={}",
                lat, lng, exception.getErrorCode().getCode());
            return Optional.empty();
        }
    }

    private WalkTimesQueryResult toQueryResult(WalkTimesClientResponse body) {
        return WalkTimesQueryResult.builder()
            .from(body.from())
            .forecastCoverageCode(body.forecastCoverage() == null ? null : body.forecastCoverage().code())
            .forecastCoverageName(body.forecastCoverage() == null ? null : body.forecastCoverage().name())
            .forecastCoverageDescription(
                body.forecastCoverage() == null ? null : body.forecastCoverage().description())
            .goldenStart(body.goldenStart())
            .goldenEnd(body.goldenEnd())
            .goldenLevelCode(body.goldenLevel() == null ? null : body.goldenLevel().code())
            .goldenLevelName(body.goldenLevel() == null ? null : body.goldenLevel().name())
            .goldenLevelDescription(body.goldenLevel() == null ? null : body.goldenLevel().description())
            .goldenLevelScoreDescription(
                body.goldenLevel() == null ? null : body.goldenLevel().scoreDescription())
            .goldenWindowStatusCode(body.goldenWindowStatus() == null ? null : body.goldenWindowStatus().code())
            .goldenWindowStatusName(body.goldenWindowStatus() == null ? null : body.goldenWindowStatus().name())
            .goldenWindowStatusDescription(
                body.goldenWindowStatus() == null ? null : body.goldenWindowStatus().description())
            .petConditionApplied(body.petConditionApplied())
            .build();
    }
}

package com.hondigagae.domainlayer.plan.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.WalkTimesClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.WeatherWarningClientResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * 여행 브리핑이 tour-service 에서 가져오는 두 가지 — 오늘의 산책 골든타임과 발효 중인 기상특보.
 *
 * <p>같은 대상 서비스를 {@code PlaceVerifyClient} · {@code PlaceSuitabilityClient} ·
 * {@code PlanPlaceLookupClient} 도 호출하므로 {@code contextId} 를 반드시 다르게 준다 —
 * 빠뜨리면 빈 이름이 충돌한다 (coding-conventions §10).
 *
 * <p>{@code name} 은 프로퍼티 참조다. 서비스명을 하드코딩하면 dev/prod 의 Eureka 등록명
 * (-dev/-prod 접미사)과 어긋나 {@code Load balancer does not contain an instance} 503 이 난다.
 *
 * <p>골든타임은 공개 API({@code /api/v1})를, 특보는 내부 API({@code /internal/v1})를 부른다.
 * 골든타임에 회원 컨텍스트가 없어 공개 경로로 충분한 반면, 특보는 웹 응답 안에만 있던 값이라
 * 서비스 간 전용 경로를 새로 열었다.
 */
@FeignClient(
    name = "${feign-client.target-services.tour-service:tour-service}",
    contextId = "insightBriefingClient"
)
public interface InsightBriefingClient {

    /**
     * 오늘 남은 시간의 산책 골든타임. 반려견 조건은 쿼리 파라미터로 넘긴다 — tour-service 는
     * 인증이 없는 공개 조회 서비스라 회원 컨텍스트를 갖지 않는다. 소유권 확인은 이 서비스가 했다.
     */
    @GetMapping("/api/v1/insights/walk-times")
    Response<WalkTimesClientResponse> getWalkTimes(
        @RequestParam("lat") double lat,
        @RequestParam("lng") double lng,
        @RequestParam(name = "petSizeType", required = false) String petSizeType,
        @RequestParam("heatSensitive") boolean heatSensitive,
        @RequestParam("coldSensitive") boolean coldSensitive,
        @RequestParam(name = "activityLevel", required = false) String activityLevel,
        @RequestParam(name = "breed", required = false) String breed
    );

    /** 제주에 발효 중인 특보 중 가장 무거운 한 건. 없으면 {@code dataBody} 가 null 인 200 이다. */
    @GetMapping("/internal/v1/weather/warnings")
    Response<WeatherWarningClientResponse> getActiveWeatherWarning();
}

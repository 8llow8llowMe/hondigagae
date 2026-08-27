package com.hondigagae.domainlayer.plan.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PlaceSuitabilityClientResponse;
import java.time.LocalDate;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * tour-service 여행 적합도 조회.
 *
 * <p>같은 대상 서비스를 {@code PlaceVerifyClient} 도 호출하므로 {@code contextId} 를 반드시
 * 다르게 준다 - 빠뜨리면 빈 이름이 충돌한다 (coding-conventions §10).
 *
 * <p>반려견 조건을 쿼리 파라미터로 넘긴다. tour-service 는 인증이 없는 공개 조회 서비스라
 * 회원 컨텍스트를 갖지 않기 때문이다. 소유권 확인은 이 서비스가 이미 했다.
 */
@FeignClient(
    name = "${feign-client.target-services.tour-service:tour-service}",
    contextId = "placeSuitabilityClient"
)
public interface PlaceSuitabilityClient {

    @GetMapping("/api/v1/places/{placeId}/suitability")
    Response<PlaceSuitabilityClientResponse> getSuitability(
        @PathVariable long placeId,
        @RequestParam("targetDate") LocalDate targetDate,
        @RequestParam(name = "petSizeType", required = false) String petSizeType,
        @RequestParam("heatSensitive") boolean heatSensitive,
        @RequestParam("coldSensitive") boolean coldSensitive,
        @RequestParam("noiseSensitive") boolean noiseSensitive,
        @RequestParam(name = "breed", required = false) String breed
    );
}

package com.hondigagae.domainlayer.plan.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.EmergencyFacilitiesClientResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * tour-service 긴급 시설 반경 검색. 일정 응급 브리핑이 방문 장소 좌표마다 부른다.
 */
@FeignClient(
    name = "${feign-client.target-services.tour-service:tour-service}",
    contextId = "emergencyFacilityClient"
)
public interface EmergencyFacilityClient {

    @GetMapping("/api/v1/emergencies/facilities")
    Response<EmergencyFacilitiesClientResponse> searchNearbyFacilities(
        @RequestParam("lat") double lat,
        @RequestParam("lng") double lng,
        @RequestParam("radius") int radius,
        @RequestParam("size") int size);
}

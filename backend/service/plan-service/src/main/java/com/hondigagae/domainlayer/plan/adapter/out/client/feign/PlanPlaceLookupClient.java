package com.hondigagae.domainlayer.plan.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PlanPlaceClientResponse;
import java.util.List;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * tour-service 내부 장소 요약 조회 — 일정 항목의 좌표를 응급 브리핑의 검색 중심점으로 쓴다.
 */
@FeignClient(
    name = "${feign-client.target-services.tour-service:tour-service}",
    contextId = "planPlaceLookupClient"
)
public interface PlanPlaceLookupClient {

    @GetMapping("/internal/v1/places/candidates")
    Response<List<PlanPlaceClientResponse>> getPlaceSummaries(
        @RequestParam("placeIds") List<Long> placeIds);
}

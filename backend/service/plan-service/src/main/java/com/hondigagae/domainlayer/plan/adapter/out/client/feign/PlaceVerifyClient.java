package com.hondigagae.domainlayer.plan.adapter.out.client.feign;

import com.fasterxml.jackson.databind.JsonNode;
import com.hondigagae.common.dto.Response;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(
    name = "${feign-client.target-services.tour-service:tour-service}",
    contextId = "placeVerifyClient"
)
public interface PlaceVerifyClient {

    // 존재 확인 용도라 본문 스키마에 의존하지 않도록 JsonNode 로 받는다.
    @GetMapping("/api/v1/places/{placeId}")
    Response<JsonNode> getPlace(@PathVariable long placeId);
}

package com.hondigagae.domainlayer.planner.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceCandidateInternalClientResponse;
import java.util.List;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * tour-service 내부 후보 조회 — 사용자가 "꼭 넣어 달라"고 지정한 장소를 후보 목록에
 * 합치기 위해 아이디로 직접 가져온다. 검색 상위 N 에 없던 장소도 필수 포함이 가능해진다.
 */
@FeignClient(
    name = "${feign-client.target-services.tour-service:tour-service}",
    contextId = "pinnedPlaceCandidateClient"
)
public interface PinnedPlaceCandidateClient {

    @GetMapping("/internal/v1/places/candidates")
    Response<List<PlaceCandidateInternalClientResponse>> getCandidates(
        @RequestParam("placeIds") List<Long> placeIds);
}

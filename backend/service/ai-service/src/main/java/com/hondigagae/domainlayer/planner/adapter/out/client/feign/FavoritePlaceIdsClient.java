package com.hondigagae.domainlayer.planner.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import java.util.List;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * plan-service 즐겨찾기 아이디 조회 — "즐겨찾기 우선 반영" 옵션에서 찜한 장소를
 * 후보에 합치고 프롬프트에 선호 표시를 하기 위해 가져온다.
 */
@FeignClient(
    name = "${feign-client.target-services.plan-service:plan-service}",
    contextId = "favoritePlaceIdsClient"
)
public interface FavoritePlaceIdsClient {

    @GetMapping("/internal/v1/favorites/place-ids")
    Response<List<Long>> getFavoritePlaceIds(@RequestParam("memberId") long memberId);
}

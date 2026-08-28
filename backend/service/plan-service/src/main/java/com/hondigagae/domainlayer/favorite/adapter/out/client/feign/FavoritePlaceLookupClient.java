package com.hondigagae.domainlayer.favorite.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.favorite.adapter.out.client.feign.dto.FavoritePlaceClientResponse;
import java.util.List;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * tour-service 내부 장소 요약 조회. 게이트웨이를 거치지 않는 내부 경로를 부른다.
 */
@FeignClient(
    name = "${feign-client.target-services.tour-service:tour-service}",
    contextId = "favoritePlaceLookupClient"
)
public interface FavoritePlaceLookupClient {

    @GetMapping("/internal/v1/places/candidates")
    Response<List<FavoritePlaceClientResponse>> getPlaceSummaries(
        @RequestParam("placeIds") List<Long> placeIds);
}

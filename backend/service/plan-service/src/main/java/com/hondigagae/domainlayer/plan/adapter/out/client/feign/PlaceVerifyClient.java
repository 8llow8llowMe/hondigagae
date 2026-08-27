package com.hondigagae.domainlayer.plan.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import java.util.List;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * tour-service 장소 존재 확인.
 *
 * <p>게이트웨이를 거치지 않는 내부 경로({@code /internal/v1})를 부른다. 항목마다 상세 API 를
 * 부르면 일정 저장 한 번에 HTTP 왕복이 항목 수만큼 생기므로 아이디 목록을 한 번에 확인한다.
 */
@FeignClient(
    name = "${feign-client.target-services.tour-service:tour-service}",
    contextId = "placeVerifyClient"
)
public interface PlaceVerifyClient {

    @GetMapping("/internal/v1/places/visible-ids")
    Response<List<Long>> getVisiblePlaceIds(@RequestParam("placeIds") List<Long> placeIds);
}

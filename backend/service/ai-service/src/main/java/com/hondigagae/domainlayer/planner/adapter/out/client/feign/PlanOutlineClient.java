package com.hondigagae.domainlayer.planner.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlanOutlineClientResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * plan-service 일정 개요 조회 — 하루 재생성 시 기존 일정의 맥락을 가져온다.
 * plan 쪽이 memberId 로 소유권을 다시 확인하므로 남의 planId 를 넣어도 개요가 나오지 않는다.
 */
@FeignClient(
    name = "${feign-client.target-services.plan-service:plan-service}",
    contextId = "planOutlineClient"
)
public interface PlanOutlineClient {

    @GetMapping("/internal/v1/plans/{planId}/outline")
    Response<PlanOutlineClientResponse> getPlanOutline(
        @PathVariable long planId, @RequestParam("memberId") long memberId);
}

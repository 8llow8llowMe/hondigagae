package com.hondigagae.domainlayer.planner.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlanAiCommitClientResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * plan-service AI 담기 조회 — 잡 조회(폴링·SSE)가 {@code committedPlanId} 를 채울 때 쓴다 (#970).
 * plan 쪽이 memberId 로 소유를 다시 걸러 남의 jobId 는 담겼어도 {@code planId: null} 이다.
 *
 * <p>같은 plan-service 를 {@link PlanOutlineClient} 도 부르므로 {@code contextId} 로 빈 이름을 가른다.
 */
@FeignClient(
    name = "${feign-client.target-services.plan-service:plan-service}",
    contextId = "planAiCommitClient"
)
public interface PlanAiCommitClient {

    @GetMapping("/internal/v1/plans/ai-commits/{jobId}")
    Response<PlanAiCommitClientResponse> getAiCommit(
        @PathVariable String jobId, @RequestParam("memberId") long memberId);
}

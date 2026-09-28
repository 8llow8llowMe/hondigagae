package com.hondigagae.domainlayer.pet.adapter.out.client.feign;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.pet.adapter.out.client.feign.dto.PlanCompanionReconcileClientResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * plan-service 동행 목록 대사 트리거 (#972).
 *
 * <p>게이트웨이를 거치지 않는 내부 경로({@code /internal/v1})를 부른다. 바디가 없다 — 무엇을 뗄지는
 * plan 이 auth 의 반려견 조회({@code GET /internal/v1/pets/conditions})로 스스로 판단한다.
 */
@FeignClient(
    name = "${feign-client.target-services.plan-service:plan-service}",
    contextId = "planCompanionClient"
)
public interface PlanCompanionClient {

    @PostMapping("/internal/v1/plans/companions/reconcile")
    Response<PlanCompanionReconcileClientResponse> reconcileCompanions(@RequestParam("memberId") long memberId);
}

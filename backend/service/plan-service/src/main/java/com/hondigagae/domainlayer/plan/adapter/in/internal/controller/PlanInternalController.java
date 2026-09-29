package com.hondigagae.domainlayer.plan.adapter.in.internal.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanAiCommitResponse;
import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanOutlineResponse;
import com.hondigagae.domainlayer.plan.application.port.in.PlanInternalUseCase;
import io.swagger.v3.oas.annotations.Hidden;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서비스 간 호출 전용 엔드포인트.
 *
 * <p><b>경로가 {@code /internal/v1} 인 것이 보호 장치다.</b> 게이트웨이는 {@code /api/v1/**}
 * 만 외부로 라우팅하므로 이 경로는 클러스터 밖에서 닿지 않는다.
 *
 * <p>ai-service 가 하루 재생성 시 기존 일정의 맥락을 가져갈 때, 잡 조회에 담은 일정을 실을 때 쓴다.
 * {@code @Hidden} 으로 공개 Swagger 문서에서 감춘다 (coding-conventions §6).
 */
@Hidden
@RestController
@RequiredArgsConstructor
@RequestMapping("/internal/v1/plans")
public class PlanInternalController {

    private final PlanInternalUseCase planInternalUseCase;

    @GetMapping("/{planId}/outline")
    public ResponseEntity<Response<PlanOutlineResponse>> getPlanOutline(
        @PathVariable long planId,
        @RequestParam long memberId
    ) {
        return ResponseEntity.ok().body(Response.success(planInternalUseCase.getPlanOutline(memberId, planId)));
    }

    /**
     * AI 일정 생성 작업을 담아 만든 일정 (#970). ai-service 의 잡 조회(폴링·SSE)가 {@code committedPlanId} 를 채울 때 쓴다.
     * 담은 적 없음·삭제됨·남의 것은 전부 200 + {@code planId: null} 이다.
     */
    @GetMapping("/ai-commits/{jobId}")
    public ResponseEntity<Response<PlanAiCommitResponse>> getAiCommit(
        @PathVariable String jobId,
        @RequestParam long memberId
    ) {
        return ResponseEntity.ok().body(Response.success(planInternalUseCase.getAiCommit(memberId, jobId)));
    }
}

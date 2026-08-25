package com.hondigagae.domainlayer.planner.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.request.AiPlanCreateRequest;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanJobStatusResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanSubmitResponse;
import com.hondigagae.domainlayer.planner.application.command.AiPlanCreateCommand;
import com.hondigagae.domainlayer.planner.application.port.in.AiPlanWebUseCase;
import com.hondigagae.security.common.dto.MemberLoginActive;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/ai-plans")
@Tag(name = "AI 여행 플래너", description = "반려견 특성과 여행 조건으로 AI 여행 일정을 생성하고 작업 상태를 조회하는 API를 제공합니다.")
public class AiPlanWebController {

    private final AiPlanWebUseCase aiPlanWebUseCase;

    @Operation(summary = "AI 여행 일정 생성 제출",
        description = "여행 조건과 반려견 정보를 받아 일정 생성 작업을 큐에 올리고 202와 함께 jobId를 반환합니다. "
            + "동일 사용자의 동일 요청이 진행 중이면 기존 jobId를 그대로 반환합니다(멱등). "
            + "생성된 일정은 제안(draft)이며, 확정 저장은 plan-service API로 수행합니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<AiPlanSubmitResponse>> submitPlan(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Valid @RequestBody AiPlanCreateRequest request
    ) {
        AiPlanSubmitResponse response = aiPlanWebUseCase.submitPlan(loginActive.memberId(), AiPlanCreateCommand.from(request));
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Response.success(response));
    }

    @Operation(summary = "AI 여행 일정 생성 작업 조회",
        description = "작업 상태와 결과를 조회합니다. 본인 작업만 조회할 수 있으며 타인의 jobId는 404로 응답합니다. "
            + "작업 실패는 200 OK + status=FAILED + errorCode/errorMessage 로 표현합니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/jobs/{jobId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<AiPlanJobStatusResponse>> getJobStatus(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "작업 식별자", required = true, example = "8a64f9c0-2f1e-4c1a-9c3e-9f2b6a7d1e00") @PathVariable String jobId
    ) {
        AiPlanJobStatusResponse response = aiPlanWebUseCase.getJobStatus(jobId, loginActive.memberId());
        return ResponseEntity.ok().body(Response.success(response));
    }

    // TODO: SSE 스트림(GET /jobs/{jobId}/stream, text/event-stream) — 폴링 외 실시간 구독 제공 (api-design-guide §7)
}

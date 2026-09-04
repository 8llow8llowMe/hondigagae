package com.hondigagae.domainlayer.planner.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.request.AiPlanCreateRequest;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanJobStatusResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.PackingListResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanSubmitResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.sse.AiPlanJobSseStreamer;
import com.hondigagae.domainlayer.planner.application.port.in.AiPlanWebUseCase;
import jakarta.servlet.http.HttpServletResponse;
import com.hondigagae.security.common.dto.MemberLoginActive;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
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
    private final AiPlanJobSseStreamer aiPlanJobSseStreamer;

    @Operation(summary = "AI 여행 일정 생성 제출",
        description = "여행 조건과 반려견 정보를 받아 일정 생성 작업을 큐에 올리고 202와 함께 jobId를 반환합니다. "
            + "동일 사용자의 동일 요청이 진행 중이면 기존 jobId를 그대로 반환합니다(멱등). "
            + "생성된 일정은 제안(draft)이며, 확정 저장은 plan-service API로 수행합니다.\n\n"
            + "**필수: areaCode, startDate, endDate (JSON 바디).** 나머지는 전부 생략 가능합니다. "
            + "반려견을 지정하지 않으면 회원의 대표 반려견 기준으로 짜고, 예산·메모를 비우면 그 조건 없이 짭니다. "
            + "시작일은 오늘 또는 그 이후여야 하고 여행 기간은 최대 10일입니다. "
            + "planId 와 regenerateDay 를 함께 주면 그 일차만 다시 짜는 하루 재생성이 됩니다(하나만 주면 AIPLAN_014).\n\n"
            + "흐름\n"
            + "1. `POST /api/v1/ai-plans` → 202 + jobId (상태 PENDING)\n"
            + "2. `GET /api/v1/ai-plans/jobs/{jobId}` 를 폴링하거나 `GET /api/v1/ai-plans/jobs/{jobId}/stream` 을 구독합니다 (PENDING → RUNNING → COMPLETED/FAILED)\n"
            + "3. status=COMPLETED 면 planDraft 를 화면에 보여 주고, 확정하려면 plan-service 저장 API 로 넘깁니다\n\n"
            + "호출 예: `POST /api/v1/ai-plans` 바디 `{\"areaCode\":\"39\",\"startDate\":\"2026-09-11\",\"endDate\":\"2026-09-13\"}`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<AiPlanSubmitResponse>> submitPlan(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Valid @RequestBody AiPlanCreateRequest request
    ) {
        AiPlanSubmitResponse response = aiPlanWebUseCase.submitPlan(loginActive.memberId(), request.toCommand());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Response.success(response));
    }

    @Operation(summary = "반려견 여행 준비물 목록 생성",
        description = "저장된 일정을 근거로 반려견 여행 준비물 목록을 AI 로 생성합니다. 일정 항목·여행 기간의 기상청 예보·"
            + "반려견 특성(체중·더위/추위 민감 등)이 근거로 쓰이며, 각 항목에 이 여행 데이터 기반의 이유가 붙습니다. "
            + "동기 API 라 LLM 응답까지 수십 초가 걸릴 수 있습니다. 결과는 저장되지 않는 제안입니다. "
            + "일정이 없거나 본인 소유가 아니면 AIPLAN_016 으로 응답합니다.\n\n"
            + "**필수: planId(경로).** 요청 바디와 쿼리 파라미터는 없습니다. "
            + "반려견 특성(일정에 등록된 동행 반려견 전체)과 여행 기간 예보는 서버가 알아서 붙이며, 가져오지 못하면 그만큼 일반적인 목록이 됩니다.\n\n"
            + "호출 예: `POST /api/v1/ai-plans/packing-list/{planId}` (바디 없음)",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PostMapping("/packing-list/{planId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PackingListResponse>> generatePackingList(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] plan-service 에 저장된 일정 아이디. 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. 실제 값은 plan-service 일정 목록·생성 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId
    ) {
        PackingListResponse response = aiPlanWebUseCase.generatePackingList(loginActive.memberId(), planId);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "AI 여행 일정 생성 작업 조회",
        description = "작업 상태와 결과를 조회합니다. 본인 작업만 조회할 수 있으며 타인의 jobId는 404로 응답합니다. "
            + "작업 실패는 200 OK + status=FAILED + errorCode/errorMessage 로 표현합니다.\n\n"
            + "**필수: jobId(경로).** 쿼리 파라미터는 없습니다. "
            + "status.code 는 PENDING 대기 중 · RUNNING 생성 중 · COMPLETED 완료 · FAILED 실패 이며, "
            + "COMPLETED 일 때만 planDraft 가, FAILED 일 때만 errorCode/errorMessage 가 채워집니다. "
            + "대기·실행 제한 시간(기본 30초·300초)을 넘긴 작업은 조회 시점에 FAILED(AIPLAN_006)로 바뀌고, "
            + "작업 기록은 보관 기간(기본 24시간)이 지나면 사라져 404 가 됩니다.\n\n"
            + "호출 예: `GET /api/v1/ai-plans/jobs/8a64f9c0-2f1e-4c1a-9c3e-9f2b6a7d1e00`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/jobs/{jobId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<AiPlanJobStatusResponse>> getJobStatus(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 작업 식별자(UUID). 제출 응답의 jobId 를 그대로 복사합니다. 예시는 형식 안내용이며 실제 값은 제출 응답에서 복사합니다", required = true, example = "8a64f9c0-2f1e-4c1a-9c3e-9f2b6a7d1e00") @PathVariable String jobId
    ) {
        AiPlanJobStatusResponse response = aiPlanWebUseCase.getJobStatus(jobId, loginActive.memberId());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(
        summary = "일정 생성 작업 상태 스트리밍 (SSE)",
        description = """
            비동기 일정 생성 작업의 상태 변경을 Server-Sent Events 로 스트리밍합니다.
            이벤트 data 는 작업 상태 조회 응답의 dataBody 와 동일한 JSON 입니다. 본인이 제출한 작업만 구독할 수 있습니다.

            수신 주기: 이벤트는 주기적으로 오지 않고 상태가 바뀔 때만 전송됩니다.
            일반적으로 구독 즉시 현재 상태 스냅샷 1회 -> RUNNING 전이 1회 -> COMPLETED/FAILED 1회, 총 2~3회 수신 후
            서버가 연결을 종료합니다 (일정 생성은 로컬 LLM 기준 수십 초 소요).
            25초 간격 하트비트는 SSE 코멘트 프레임이라 onmessage 로 수신되지 않으며 클라이언트 처리가 필요 없습니다.

            브라우저 기본 EventSource 는 Authorization 헤더를 지원하지 않으므로
            fetch 기반 SSE 클라이언트(예: @microsoft/fetch-event-source)를 사용하세요.
            연결이 끊기면 GET /jobs/{jobId} 폴링으로 폴백하면 됩니다.

            이벤트 이름은 `job-update` 하나입니다(클라이언트는 이 이름으로 리스너를 등록합니다).
            종료 조건: status.code 가 COMPLETED 또는 FAILED 인 이벤트를 보낸 직후 서버가 연결을 닫습니다.
            구독 시점에 이미 종결 상태면 그 스냅샷 1회를 보내고 바로 닫습니다.
            jobId 가 없거나 타인의 것이면 스트림이 열리기 전에 일반 JSON 오류(404, AIPLAN_002)로 응답합니다.

            **필수: jobId(경로).** 쿼리 파라미터는 없습니다.

            호출 예: `GET /api/v1/ai-plans/jobs/8a64f9c0-2f1e-4c1a-9c3e-9f2b6a7d1e00/stream` (Accept: text/event-stream, Authorization: Bearer 토큰)""",
        security = {@SecurityRequirement(name = "bearerAuth")}
    )
    @PreAuthorize("isAuthenticated()")
    @GetMapping(value = "/jobs/{jobId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamJobStatus(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 작업 식별자(UUID). 제출 응답의 jobId 를 그대로 복사합니다. 예시는 형식 안내용이며 실제 값은 제출 응답에서 복사합니다", required = true, example = "8a64f9c0-2f1e-4c1a-9c3e-9f2b6a7d1e00") @PathVariable String jobId,
        HttpServletResponse response
    ) {
        // nginx 등 리버스 프록시가 이 응답을 버퍼링하지 않도록 응답 단위로 지시한다 (프록시 설정과 이중 방어).
        response.setHeader("X-Accel-Buffering", "no");
        return aiPlanJobSseStreamer.stream(jobId, loginActive.memberId());
    }

}

package com.hondigagae.domainlayer.plan.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanCompanionSummaryResponse;
import com.hondigagae.domainlayer.plan.application.port.in.PlanWebUseCase;
import com.hondigagae.security.common.dto.MemberLoginActive;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 반려견 기준으로 본 내 일정의 동행 정보 (#972).
 *
 * <p>반려견 원천은 auth-service 지만 "그 아이가 어느 일정에 실려 있는가" 의 원천은 이 서비스다.
 * 반려견 삭제 확인창이 삭제 전에 이 집계를 먼저 읽는다.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/plans/companions")
@Tag(name = "여행 일정 동행 반려견", description = "반려견이 동행한 내 일정을 반려견 기준으로 집계하는 API를 제공합니다.")
public class PlanCompanionWebController {

    private final PlanWebUseCase planWebUseCase;

    @Operation(summary = "반려견 동행 일정 집계 (삭제 확인창)",
        description = "이 반려견을 삭제하면 내 일정이 어떻게 바뀌는지 미리 알려 줍니다. 반려견 삭제 확인창이 삭제 요청 전에 부릅니다.\n\n"
            + "- editablePlanCount: 초안·확정 일정 중 이 반려견이 동행한 일정 수 — 삭제하면 동행 목록에서 빠집니다\n"
            + "- soleCompanionPlanCount: 그중 이 반려견 한 마리만 동행한 일정 수 — 일정은 남고, 동행 목록에는 삭제된 아이디가 남습니다\n"
            + "- completedPlanCount: 완료 일정 중 동행한 일정 수 — 다녀온 기록이라 바뀌지 않습니다\n\n"
            + "**필수: petId (경로).** 내 반려견이 아니거나 없는 아이디면 404 가 아니라 세 값이 모두 0 입니다.\n\n"
            + "호출 예\n"
            + "- `GET /api/v1/plans/companions/1234567890123456789`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/{petId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanCompanionSummaryResponse>> getCompanionSummary(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 반려견 아이디. Snowflake 라 환경마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 반려견 목록 응답의 petId 를 씁니다", required = true, example = "1234567890123456789") @PathVariable long petId
    ) {
        PlanCompanionSummaryResponse response = planWebUseCase.getCompanionSummary(loginActive.memberId(), petId);
        return ResponseEntity.ok().body(Response.success(response));
    }
}

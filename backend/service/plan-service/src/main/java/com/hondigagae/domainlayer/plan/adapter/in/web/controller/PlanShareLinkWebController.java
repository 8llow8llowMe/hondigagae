package com.hondigagae.domainlayer.plan.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanShareLinkResponse;
import com.hondigagae.domainlayer.plan.application.port.in.PlanShareLinkWebUseCase;
import com.hondigagae.security.common.dto.MemberLoginActive;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 일정 주인이 공유 링크를 켜고 끄는 API (이슈 #627). 링크로 여는 쪽은
 * {@code SharedPlanWebController} 가 <b>비인증</b>으로 따로 받는다.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/plans")
@Tag(name = "여행 일정 공유 링크", description = "일정을 읽기 전용 링크로 공유하고 폐기하는 API를 제공합니다.")
public class PlanShareLinkWebController {

    private final PlanShareLinkWebUseCase planShareLinkWebUseCase;

    @Operation(summary = "일정 공유 링크 발급",
        description = "일정을 읽기 전용으로 여는 링크를 발급합니다. 공개 조회 주소는 `/api/v1/shared-plans/{token}` 입니다.\n\n"
            + "**확정(CONFIRMED)·완료(COMPLETED) 일정만** 공유할 수 있습니다 — 초안은 `PLAN_022` 400 입니다. "
            + "유효 기간은 발급 시각부터 **30일 고정**이고 요청 바디는 없습니다.\n\n"
            + "**멱등입니다.** 아직 폐기·만료되지 않은 링크가 있으면 새로 만들지 않고 그 토큰을 그대로 돌려줍니다 — "
            + "링크를 바꾸려면 DELETE 로 폐기한 뒤 다시 POST 하세요.\n\n"
            + "호출 예\n"
            + "- `POST /api/v1/plans/1234567890123456789/share-link`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PostMapping("/{planId}/share-link")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanShareLinkResponse>> issueShareLink(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 라 환경마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 일정 목록 응답의 planId 를 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId
    ) {
        PlanShareLinkResponse response = planShareLinkWebUseCase.issueShareLink(loginActive.memberId(), planId);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "일정 공유 링크 조회",
        description = "현재 유효한 공유 링크를 조회합니다. 한 번도 발급하지 않았거나 이미 폐기·만료됐으면 `PLAN_023` 404 입니다 — "
            + "어느 쪽이든 할 일은 새로 발급하는 것으로 같습니다.\n\n"
            + "**필수: planId (경로).**\n\n"
            + "호출 예\n"
            + "- `GET /api/v1/plans/1234567890123456789/share-link`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/{planId}/share-link")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanShareLinkResponse>> getShareLink(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. 예시 값은 형식 안내용입니다", required = true, example = "1234567890123456789") @PathVariable long planId
    ) {
        PlanShareLinkResponse response = planShareLinkWebUseCase.getShareLink(loginActive.memberId(), planId);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "일정 공유 링크 폐기",
        description = "공유 링크를 폐기합니다. 폐기된 링크로 열면 `PLAN_023` 404 가 됩니다.\n\n"
            + "**멱등입니다.** 폐기할 링크가 없어도 200 으로 답합니다 — 결과 상태(\"공유 중이 아니다\")가 같기 때문입니다.\n\n"
            + "호출 예\n"
            + "- `DELETE /api/v1/plans/1234567890123456789/share-link`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @DeleteMapping("/{planId}/share-link")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> revokeShareLink(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. 예시 값은 형식 안내용입니다", required = true, example = "1234567890123456789") @PathVariable long planId
    ) {
        planShareLinkWebUseCase.revokeShareLink(loginActive.memberId(), planId);
        return ResponseEntity.ok().body(Response.success());
    }
}

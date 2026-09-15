package com.hondigagae.domainlayer.plan.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanReviewUpsertRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanReviewResponse;
import com.hondigagae.domainlayer.plan.application.port.in.PlanReviewWebUseCase;
import com.hondigagae.security.common.dto.MemberLoginActive;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/plans")
@Tag(name = "여행 후기", description = "완료된 일정의 여행 후기 조회/작성/수정 API를 제공합니다.")
public class PlanReviewWebController {

    private final PlanReviewWebUseCase planReviewWebUseCase;

    @Operation(summary = "여행 후기 조회",
        description = "일정에 작성한 후기를 조회합니다. 본인 소유가 아니면 404로 응답합니다. "
            + "**완료(COMPLETED)된 일정만** 볼 수 있습니다. 초안·확정은 PLAN_016, 후기가 없으면 PLAN_015 입니다. "
            + "일차를 교체해 사라진 장소 항목도 당시 제목·장소 아이디로 남습니다. 사진·공개 범위는 없습니다.\n\n"
            + "**필수: planId (경로).**\n\n"
            + "호출 예\n"
            + "- `GET /api/v1/plans/1234567890123456789/reviews`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/{planId}/reviews")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanReviewResponse>> getReview(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId
    ) {
        PlanReviewResponse response = planReviewWebUseCase.getReview(loginActive.memberId(), planId);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "여행 후기 작성",
        description = "완료된 일정에 후기를 하나 작성합니다. 이미 있으면 PLAN_017(409) 입니다 — 수정은 PUT 입니다. "
            + "장소별 평가는 **다녀온 장소 항목**(PLACE/MEAL/LODGING + visited)만 받을 수 있고, "
            + "제목·placeId 는 서버가 그때의 일정 항목에서 기억합니다. 사진·공개 범위·AI 초안은 없습니다.\n\n"
            + "**필수: planId (경로), 바디 overallRating·items.** body 와 각 comment 는 생략 가능합니다. "
            + "items 를 빈 목록으로 내면 전체 만족도만 저장합니다.\n\n"
            + "호출 예\n"
            + "- `POST /api/v1/plans/1234567890123456789/reviews` "
            + "`{\"overallRating\":4,\"body\":\"둘째 날이 더웠다.\",\"items\":[{\"planItemId\":1234567890123456790,\"rating\":5,\"comment\":\"그늘이 많았다.\"}]}`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PostMapping("/{planId}/reviews")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanReviewResponse>> createReview(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId,
        @Valid @RequestBody PlanReviewUpsertRequest request
    ) {
        PlanReviewResponse response = planReviewWebUseCase.createReview(
            loginActive.memberId(), planId, request.toCommand());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "여행 후기 수정",
        description = "이미 작성한 후기를 고칩니다. 후기가 없으면 PLAN_015, 완료가 아니면 PLAN_016 입니다. "
            + "`items` 는 **전량 교체**입니다 — 빠진 장소 평가는 사라지고, 일차 교체로 항목이 없어도 "
            + "이미 기억한 planItemId 는 제목·placeId 를 유지한 채 평점·한 줄만 고칩니다.\n\n"
            + "**필수: planId (경로), 바디 overallRating·items.**\n\n"
            + "호출 예\n"
            + "- `PUT /api/v1/plans/1234567890123456789/reviews` "
            + "`{\"overallRating\":5,\"body\":null,\"items\":[]}`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PutMapping("/{planId}/reviews")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanReviewResponse>> updateReview(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId,
        @Valid @RequestBody PlanReviewUpsertRequest request
    ) {
        PlanReviewResponse response = planReviewWebUseCase.updateReview(
            loginActive.memberId(), planId, request.toCommand());
        return ResponseEntity.ok().body(Response.success(response));
    }
}

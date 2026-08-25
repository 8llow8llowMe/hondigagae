package com.hondigagae.domainlayer.plan.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanSummaryItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanCreateRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanDayItemsReplaceRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanUpdateRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanDetailResponse;
import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import com.hondigagae.domainlayer.plan.application.port.in.PlanWebUseCase;
import com.hondigagae.persistence.dto.SliceResponse;
import com.hondigagae.security.common.dto.MemberLoginActive;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/plans")
@Tag(name = "여행 일정", description = "여행 일정 생성/조회/수정/삭제와 일자별 항목 편집 API를 제공합니다.")
public class PlanWebController {

    private final PlanWebUseCase planWebUseCase;

    @Operation(summary = "여행 일정 생성",
        description = "여행 일정을 생성합니다. 일정 항목을 함께 보내면 같이 저장하며, 장소 항목은 tour-service에서 존재를 검증합니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanDetailResponse>> createPlan(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Valid @RequestBody PlanCreateRequest request
    ) {
        PlanDetailResponse response = planWebUseCase.createPlan(loginActive.memberId(), request.toCommand());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "내 여행 일정 목록 조회", description = "커서 기반으로 내 여행 일정 목록을 조회합니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<SliceResponse<PlanSummaryItem>>> getMyPlans(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "마지막으로 받은 일정 아이디 (첫 페이지는 생략)", example = "1234567890123456789") @RequestParam(required = false) Long lastPlanId,
        @Parameter(description = "조회 개수", example = "10")
        @RequestParam(defaultValue = "10")
        @Min(value = 1, message = PlanValidationMessage.SIZE_RANGE_INVALID)
        @Max(value = 50, message = PlanValidationMessage.SIZE_RANGE_INVALID) int size
    ) {
        SliceResponse<PlanSummaryItem> response = planWebUseCase.getMyPlans(loginActive.memberId(), lastPlanId, size);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "여행 일정 상세 조회", description = "일자별 항목을 포함한 일정 상세를 조회합니다. 본인 소유가 아니면 404로 응답합니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/{planId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanDetailResponse>> getPlan(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "일정 아이디", required = true, example = "1234567890123456789") @PathVariable long planId
    ) {
        PlanDetailResponse response = planWebUseCase.getPlan(loginActive.memberId(), planId);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "여행 일정 수정", description = "일정 기본 정보를 수정합니다. 전달한 필드만 반영되고 생략한 필드는 기존 값을 유지합니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PutMapping("/{planId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanDetailResponse>> updatePlan(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "일정 아이디", required = true, example = "1234567890123456789") @PathVariable long planId,
        @Valid @RequestBody PlanUpdateRequest request
    ) {
        PlanDetailResponse response = planWebUseCase.updatePlan(loginActive.memberId(), planId, request.toCommand());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "여행 일정 삭제", description = "여행 일정을 삭제합니다. 소프트 삭제로 처리됩니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @DeleteMapping("/{planId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> deletePlan(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "일정 아이디", required = true, example = "1234567890123456789") @PathVariable long planId
    ) {
        planWebUseCase.deletePlan(loginActive.memberId(), planId);
        return ResponseEntity.ok().body(Response.success());
    }

    @Operation(summary = "일자별 일정 항목 일괄 교체",
        description = "해당 일차의 항목을 요청 본문 목록으로 교체합니다. 빈 목록을 보내면 해당 일차 항목이 모두 삭제됩니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PutMapping("/{planId}/days/{day}/items")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanDetailResponse>> replaceDayItems(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "일정 아이디", required = true, example = "1234567890123456789") @PathVariable long planId,
        @Parameter(description = "일차 (1부터)", required = true, example = "1") @PathVariable int day,
        @Valid @RequestBody PlanDayItemsReplaceRequest request
    ) {
        PlanDetailResponse response = planWebUseCase.replaceDayItems(loginActive.memberId(), planId, day, request.toCommands());
        return ResponseEntity.ok().body(Response.success(response));
    }
}

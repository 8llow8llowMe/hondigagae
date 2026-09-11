package com.hondigagae.domainlayer.plan.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanPackingItemAddRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanPackingItemCheckedRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanPackingItemsSaveRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanPackingListResponse;
import com.hondigagae.domainlayer.plan.application.port.in.PlanPackingWebUseCase;
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
import org.springframework.web.bind.annotation.DeleteMapping;
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
@Tag(name = "여행 준비물", description = "일정에 저장된 여행 준비물 조회/저장/추가/체크/삭제 API를 제공합니다.")
public class PlanPackingWebController {

    private final PlanPackingWebUseCase planPackingWebUseCase;

    @Operation(summary = "여행 준비물 조회",
        description = "일정에 저장된 준비물 목록을 표시 순서대로 조회합니다. 본인 소유가 아니면 404로 응답합니다. "
            + "저장된 것이 없으면 items 가 빈 목록이고 generatedAt 은 null 입니다 — 그때 AI 준비물 생성"
            + "(`POST /api/v1/ai-plans/packing-list/{planId}`)을 부르고 그 결과를 저장 API 로 넣으세요. "
            + "items 가 있으면 LLM 을 다시 돌리지 않습니다.\n\n"
            + "**필수: planId (경로).**\n\n"
            + "호출 예\n"
            + "- `GET /api/v1/plans/1234567890123456789/packing-items`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/{planId}/packing-items")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanPackingListResponse>> getPackingItems(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId
    ) {
        PlanPackingListResponse response = planPackingWebUseCase.getPackingItems(loginActive.memberId(), planId);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "여행 준비물 저장 (AI 결과 교체)",
        description = "AI 준비물 생성 결과를 저장합니다. **AI 항목만 교체하고 사용자가 직접 추가한 항목은 남습니다** — "
            + "직접 적어 둔 것을 재생성이 말없이 지우지 않기 위해서입니다. 빈 목록을 보내면 AI 항목이 모두 삭제됩니다.\n\n"
            + "재생성해도 **같은 이름의 챙김 체크는 승계됩니다** — 짐을 반쯤 싸 둔 상태에서 다시 뽑기를 눌러도 체크가 날아가지 않습니다. "
            + "사용자 항목과 이름이 겹치는 AI 항목과, 보낸 목록 안에서 중복된 이름은 버려집니다(첫 것만 남습니다). "
            + "남는 사용자 항목까지 합쳐 50개를 넘으면 PLAN_013 으로 실패합니다.\n\n"
            + "**필수: planId (경로), 바디 items, 각 항목의 category·name.** reason 은 생략 가능합니다.\n\n"
            + "호출 예\n"
            + "- `PUT /api/v1/plans/1234567890123456789/packing-items` "
            + "`{\"items\":[{\"category\":\"반려견 케어\",\"name\":\"리드줄\",\"reason\":\"숲길 코스가 이틀 들어 있어 목줄 착용 구간이 깁니다.\"}]}`\n"
            + "- AI 항목 비우기: 같은 URL 에 `{\"items\":[]}`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PutMapping("/{planId}/packing-items")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanPackingListResponse>> replacePackingItems(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId,
        @Valid @RequestBody PlanPackingItemsSaveRequest request
    ) {
        PlanPackingListResponse response = planPackingWebUseCase.replacePackingItems(
            loginActive.memberId(), planId, request.toCommands());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "여행 준비물 직접 추가",
        description = "AI 가 빠뜨린 준비물을 사용자가 직접 더합니다. source 는 USER 로 저장되어 **AI 재생성에도 지워지지 않습니다.** "
            + "이유(reason)는 받지 않습니다 — 이 여행의 일정·날씨를 읽은 AI 만 붙일 수 있는 값입니다. "
            + "표시 순서는 기존 항목 맨 뒤로 붙습니다.\n\n"
            + "이미 같은 이름의 항목이 있으면 PLAN_012(409), 일정당 50개를 넘기면 PLAN_013(400) 으로 실패합니다.\n\n"
            + "**필수: planId (경로), 바디의 category·name.**\n\n"
            + "호출 예\n"
            + "- `POST /api/v1/plans/1234567890123456789/packing-items` `{\"category\":\"반려견 케어\",\"name\":\"배변봉투\"}`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PostMapping("/{planId}/packing-items")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanPackingListResponse>> addPackingItem(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId,
        @Valid @RequestBody PlanPackingItemAddRequest request
    ) {
        PlanPackingListResponse response = planPackingWebUseCase.addPackingItem(
            loginActive.memberId(), planId, request.toCommand());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "여행 준비물 챙김 체크",
        description = "짐을 쌀 때 항목별로 '챙김'을 표시합니다. 해제도 같은 API 로 합니다(checked=false). "
            + "AI 재생성을 해도 같은 이름의 항목에 체크가 승계되므로 이 표시는 다시 뽑기를 넘겨 살아남습니다.\n\n"
            + "**필수: planId, packingItemId (경로), 바디의 checked.**\n\n"
            + "호출 예\n"
            + "- 챙김 체크: `PUT /api/v1/plans/1234567890123456789/packing-items/1234567890123456790/checked` `{\"checked\":true}`\n"
            + "- 체크 해제: 같은 URL 에 `{\"checked\":false}`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PutMapping("/{planId}/packing-items/{packingItemId}/checked")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> markPackingItemChecked(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId,
        @Parameter(description = "[필수] 준비물 항목 아이디. Snowflake 라 환경마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 준비물 조회 응답 items 의 packingItemId 를 씁니다", required = true, example = "1234567890123456790") @PathVariable long packingItemId,
        @Valid @RequestBody PlanPackingItemCheckedRequest request
    ) {
        planPackingWebUseCase.markPackingItemChecked(loginActive.memberId(), planId, packingItemId, request.checked());
        return ResponseEntity.ok().body(Response.success());
    }

    @Operation(summary = "여행 준비물 삭제",
        description = "준비물 항목 하나를 삭제합니다. AI 항목과 직접 추가한 항목을 구분하지 않습니다 — 둘 다 지울 수 있습니다. "
            + "AI 항목을 지운 뒤 다시 저장(재생성)하면 그 항목은 되살아납니다.\n\n"
            + "**필수: planId, packingItemId (경로).**\n\n"
            + "호출 예\n"
            + "- `DELETE /api/v1/plans/1234567890123456789/packing-items/1234567890123456790`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @DeleteMapping("/{planId}/packing-items/{packingItemId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> deletePackingItem(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId,
        @Parameter(description = "[필수] 준비물 항목 아이디. Snowflake 라 환경마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 준비물 조회 응답 items 의 packingItemId 를 씁니다", required = true, example = "1234567890123456790") @PathVariable long packingItemId
    ) {
        planPackingWebUseCase.deletePackingItem(loginActive.memberId(), planId, packingItemId);
        return ResponseEntity.ok().body(Response.success());
    }
}

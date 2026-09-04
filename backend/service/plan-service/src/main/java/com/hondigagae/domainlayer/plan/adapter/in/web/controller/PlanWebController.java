package com.hondigagae.domainlayer.plan.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanSummaryItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanCreateRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanDayItemsReplaceRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanUpdateRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.request.PlanItemVisitedRequest;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanDetailResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanEmergencyResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanWeatherResponse;
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
        description = "여행 일정을 생성합니다. 일정 항목을 함께 보내면 같이 저장하며, 장소 항목은 tour-service에서 존재를 검증합니다. "
            + "동행 반려견은 petIds(최대 5마리)로 보내고 첫 번째가 대표 반려견이 됩니다. petIds 가 없으면 petId 를, "
            + "둘 다 없으면 대표 반려견을 씁니다 — AI 일정 생성(POST /ai-plans)과 같은 규칙입니다.\n\n"
            + "**필수: 요청 바디의 areaCode, title, startDate, endDate.** petId·petIds·sigunguCode·budget·items 는 생략 가능하고, "
            + "여행 기간(startDate~endDate)은 최대 30일입니다. items 를 보낼 때는 각 항목의 day·itemType·title 이 필수입니다.\n\n"
            + "호출 예\n"
            + "- 최소 바디(대표 반려견, 항목 없음): `POST /api/v1/plans` "
            + "`{\"areaCode\":\"39\",\"title\":\"몽실이와 제주 2박 3일\",\"startDate\":\"2026-09-12\",\"endDate\":\"2026-09-14\"}`\n"
            + "- 반려견 두 마리 지정: 위 바디에 `\"petIds\":[1234567890123456789,1234567890123456790]` 추가",
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

    @Operation(summary = "내 여행 일정 목록 조회",
        description = "커서 기반으로 내 여행 일정 목록을 조회합니다. 일정 아이디 내림차순(최근 생성순)으로 내려갑니다.\n\n"
            + "**필수 파라미터는 없습니다.** 전부 생략하면 내 일정 전체의 첫 페이지(10개)가 옵니다.\n\n"
            + "호출 예\n"
            + "- 첫 페이지: `GET /api/v1/plans`\n"
            + "- 특정 반려견이 동행한 일정만: `GET /api/v1/plans?petId=1234567890123456789`\n"
            + "- 다음 페이지: 직전 응답 `items` 마지막의 `planId` 를 `lastPlanId` 로 — `GET /api/v1/plans?lastPlanId=1234567890123456789&size=10`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<SliceResponse<PlanSummaryItem>>> getMyPlans(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[선택] 반려견 아이디. 지정하면 그 반려견이 동행한 일정만 조회합니다 (반려견별 여행 히스토리). "
            + "여러 마리 일정은 그중 한 마리로 들어 있어도 조회됩니다. 생략하면 내 일정 전체. "
            + "Snowflake 라 환경마다 다르고 예시 값은 형식 안내용, 실제 값은 반려견 목록 응답의 petId 를 씁니다",
            example = "1234567890123456789") @RequestParam(required = false) Long petId,
        @Parameter(description = "[선택] 커서. 첫 페이지는 생략하고, 다음 페이지는 직전 응답 마지막 항목의 planId 를 넣습니다. 예시 값은 형식 안내용",
            example = "1234567890123456789") @RequestParam(required = false) Long lastPlanId,
        @Parameter(description = "[선택, 기본 10] 조회 개수 (1~50)", example = "10")
        @RequestParam(defaultValue = "10")
        @Min(value = 1, message = PlanValidationMessage.SIZE_RANGE_INVALID)
        @Max(value = 50, message = PlanValidationMessage.SIZE_RANGE_INVALID) int size
    ) {
        SliceResponse<PlanSummaryItem> response = planWebUseCase.getMyPlans(loginActive.memberId(), petId, lastPlanId, size);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "여행 일정 상세 조회",
        description = "일자별 항목을 포함한 일정 상세를 조회합니다. 본인 소유가 아니면 404로 응답합니다.\n\n"
            + "**필수: planId (경로).**\n\n"
            + "호출 예\n"
            + "- `GET /api/v1/plans/1234567890123456789`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/{planId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanDetailResponse>> getPlan(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. 실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId
    ) {
        PlanDetailResponse response = planWebUseCase.getPlan(loginActive.memberId(), planId);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "여행 일정 수정",
        description = "일정 기본 정보를 수정합니다. 전달한 필드만 반영되고 생략한 필드는 기존 값을 유지합니다. "
            + "기간을 줄일 때 기존 항목의 일차가 새 기간을 벗어나면 실패합니다.\n\n"
            + "**필수: planId (경로).** 바디 필드(title·startDate·endDate·budget·status)는 모두 선택입니다.\n\n"
            + "호출 예\n"
            + "- 제목만 변경: `PUT /api/v1/plans/1234567890123456789` `{\"title\":\"몽실이와 제주 2박 3일\"}`\n"
            + "- 확정 처리: `PUT /api/v1/plans/1234567890123456789` `{\"status\":\"CONFIRMED\"}`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PutMapping("/{planId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanDetailResponse>> updatePlan(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. 실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId,
        @Valid @RequestBody PlanUpdateRequest request
    ) {
        PlanDetailResponse response = planWebUseCase.updatePlan(loginActive.memberId(), planId, request.toCommand());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "여행 일정 삭제",
        description = "여행 일정을 삭제합니다. 소프트 삭제로 처리됩니다.\n\n"
            + "**필수: planId (경로).**\n\n"
            + "호출 예\n"
            + "- `DELETE /api/v1/plans/1234567890123456789`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @DeleteMapping("/{planId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> deletePlan(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. 실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId
    ) {
        planWebUseCase.deletePlan(loginActive.memberId(), planId);
        return ResponseEntity.ok().body(Response.success());
    }

    @Operation(summary = "일자별 일정 항목 일괄 교체",
        description = "해당 일차의 항목을 요청 본문 목록으로 교체합니다. 빈 목록을 보내면 해당 일차 항목이 모두 삭제됩니다.\n\n"
            + "**필수: planId, day (경로), 바디 items 각 항목의 itemType·title.** 항목의 day 는 경로 값으로 덮어쓰므로 바디에서 생략해도 되고, "
            + "경로의 day 가 일정 기간을 벗어나면 실패합니다. 같은 일차 안에서 sequence 가 겹치면 실패합니다.\n\n"
            + "호출 예\n"
            + "- 1일차를 항목 하나로 교체: `PUT /api/v1/plans/1234567890123456789/days/1/items` "
            + "`{\"items\":[{\"sequence\":0,\"itemType\":\"PLACE\",\"targetId\":212481712381923328,\"title\":\"천지연폭포\"}]}`\n"
            + "- 1일차 비우기: `PUT /api/v1/plans/1234567890123456789/days/1/items` `{\"items\":[]}`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PutMapping("/{planId}/days/{day}/items")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanDetailResponse>> replaceDayItems(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. 실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId,
        @Parameter(description = "[필수] 일차 (1부터, 일정 기간 안). 2박 3일 일정이면 1~3", required = true, example = "1") @PathVariable int day,
        @Valid @RequestBody PlanDayItemsReplaceRequest request
    ) {
        PlanDetailResponse response = planWebUseCase.replaceDayItems(loginActive.memberId(), planId, day, request.toCommands());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "일정 날씨 브리핑",
        description = "일정의 날짜별로 날씨와 반려견 여행 적합도를 같이 보여 줍니다. "
            + "그날 첫 장소 항목을 기준으로 판정하며, 반려견 특성은 등록된 프로필을 자동으로 반영합니다. "
            + "여러 마리 일정은 아이별로 따로 판정하고 점수가 가장 낮은 아이를 그날의 기준(basisPetId)으로 삼습니다 — "
            + "아이별 점수는 petSuitabilities 에 함께 내려갑니다. "
            + "예보는 단기·중기를 합쳐 약 11일까지 제공되므로 그보다 먼 날짜는 score 가 null 이고 "
            + "unavailableReason 에 그 이유가 담깁니다 — 점수가 낮은 것이 아니라 판단 근거가 없는 것입니다. "
            + "비 예보가 있고 그날 장소가 실내가 아니면 indoorAlternatives 에 실내 대안을 함께 내려 줍니다. "
            + "일정을 실제로 바꾸는 것은 이 API 가 아니라 일자별 항목 교체 API 로 명시적으로 합니다.\n\n"
            + "**필수: planId (경로).**\n\n"
            + "호출 예\n"
            + "- `GET /api/v1/plans/1234567890123456789/weather`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/{planId}/weather")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanWeatherResponse>> getPlanWeather(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. 실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId
    ) {
        PlanWeatherResponse response = planWebUseCase.getPlanWeather(loginActive.memberId(), planId);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "일정 항목 방문 체크",
        description = "여행 중 항목별로 '다녀옴'을 표시합니다. 해제도 같은 API 로 합니다(visited=false). "
            + "일차 항목을 교체하면 새 항목이 되므로 그 날의 체크는 초기화됩니다.\n\n"
            + "**필수: planId, planItemId (경로), 바디의 visited.**\n\n"
            + "호출 예\n"
            + "- 다녀옴 체크: `PUT /api/v1/plans/1234567890123456789/items/1234567890123456789/visited` `{\"visited\":true}`\n"
            + "- 체크 해제: 같은 URL 에 `{\"visited\":false}`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PutMapping("/{planId}/items/{planItemId}/visited")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> markItemVisited(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. 실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId,
        @Parameter(description = "[필수] 일정 항목 아이디. Snowflake 라 환경마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 일정 상세 응답 items 의 planItemId 를 씁니다", required = true, example = "1234567890123456789") @PathVariable long planItemId,
        @Valid @RequestBody PlanItemVisitedRequest request
    ) {
        planWebUseCase.markItemVisited(loginActive.memberId(), planId, planItemId, request.visited());
        return ResponseEntity.ok().body(Response.success());
    }

    @Operation(summary = "일정 응급 브리핑",
        description = "일자별 방문 장소마다 가까운 동물병원·동물약국(반경 10km, 가까운 순 최대 3곳)을 미리 묶어 보여 줍니다. "
            + "급할 때 검색을 시작하면 늦기 때문에 출발 전 확인 용도입니다. "
            + "운영시간 정보가 없는 시설(operatingHoursKnown=false)은 휴무가 아니라 확인 필요이므로 전화 확인을 안내해야 합니다.\n\n"
            + "**필수: planId (경로).**\n\n"
            + "호출 예\n"
            + "- `GET /api/v1/plans/1234567890123456789/emergency`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/{planId}/emergency")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanEmergencyResponse>> getPlanEmergencyBriefing(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. 실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789") @PathVariable long planId
    ) {
        PlanEmergencyResponse response = planWebUseCase.getPlanEmergencyBriefing(loginActive.memberId(), planId);
        return ResponseEntity.ok().body(Response.success(response));
    }
}

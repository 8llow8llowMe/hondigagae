package com.hondigagae.domainlayer.plan.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanWalkSafetyResponse;
import com.hondigagae.domainlayer.plan.application.port.in.PlanWalkSafetyWebUseCase;
import com.hondigagae.security.common.dto.MemberLoginActive;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/plans")
@Tag(name = "일정 산책 위험도", description = "일정 항목의 시각 기준 산책 위험도 조회 API를 제공합니다.")
public class PlanWalkSafetyWebController {

    private final PlanWalkSafetyWebUseCase planWalkSafetyWebUseCase;

    @Operation(summary = "일정 항목 산책 위험도",
        description = "일정 항목마다 **그 항목의 시각 기준으로** 산책 위험도를 판정합니다. "
            + "일자 날씨 브리핑(`/weather`)이 \"둘째 날 괜찮아?\" 에 답한다면 이 API 는 "
            + "\"두 시에 그 해수욕장 걸어도 돼?\" 에 답합니다 — 산책 위험도는 시각에 따라 갈려 일자로 접을 수 없습니다. "
            + "판정 규칙(노면온도 추정·체감온도·등급 임계)은 장소 산책 위험도 API 와 **같은 것**을 씁니다. "
            + "판정 기준 반려견(basisPetId)은 **그날 날씨 판정의 기준과 같습니다** — 두 화면이 같은 날을 다른 아이 기준으로 말하지 않게 합니다.\n\n"
            + "판정을 못 낸 항목도 줄은 그대로 내려가고 unavailableReasonCode 와 unavailableReason(문장)이 짝으로 옵니다. "
            + "코드는 다섯으로 갈립니다 — PAST_DATE(지난 날짜, 다시 물어도 생기지 않습니다) · "
            + "NOT_PLACE_TARGET(좌표를 아는 장소 항목이 아님, 예: 올레 코스·이동) · "
            + "NO_START_TIME(항목에 시각이 없음 — **없는 시각을 정오 등으로 지어내지 않습니다**) · "
            + "BEYOND_FORECAST_RANGE(시각별 예보 범위 밖, 기다리면 풀립니다) · "
            + "LOOKUP_FAILED(조회 실패, 다섯 중 이것만 일시적 장애입니다). 재시도 안내는 이 코드로 판단하고 문장을 파싱하지 않습니다.\n\n"
            + "**시각별 예보가 닿는 범위는 `오늘 ~ 오늘+4`(5일)로, 일자 날씨 브리핑의 11일보다 짧습니다.** "
            + "산책 위험도는 노면온도를 시각·일사로 추정해야 해서 시각별 데이터가 있는 단기예보만 쓰고, "
            + "중기예보(오늘+4~오늘+10)에는 오전/오후뿐이라 오후 두 시 아스팔트를 계산할 수 없기 때문입니다. "
            + "그 밖의 날짜는 원격 호출 없이 BEYOND_FORECAST_RANGE 로 내려갑니다 — 같은 일정이라도 "
            + "`/weather` 에는 판정이 있는데 여기는 비어 있는 날이 **정상**입니다.\n\n"
            + "근거 목록·시간대별 판정·특보 상세는 이 응답에 없습니다 — 항목마다 실어 나르면 응답이 항목 수만큼 부풀기 때문입니다. "
            + "필요하면 장소 산책 위험도 API(`GET /api/v1/places/{placeId}/walk-safety`)를 직접 부르세요. "
            + "판정을 못 낸 줄에도 placeId 는 남습니다(NOT_PLACE_TARGET 제외) — 그래야 그 줄에서 직접 부를 수 있습니다.\n\n"
            + "**필수: planId (경로).**\n\n"
            + "호출 예\n"
            + "- `GET /api/v1/plans/1234567890123456789/walk-safety`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/{planId}/walk-safety")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PlanWalkSafetyResponse>> getWalkSafety(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 일정 아이디. Snowflake 숫자라 환경(dev/prod)마다 다르고 예시 값은 형식 안내용입니다. "
            + "실제 값은 일정 목록 응답의 planId 를 그대로 씁니다", required = true, example = "1234567890123456789")
        @PathVariable long planId
    ) {
        PlanWalkSafetyResponse response = planWalkSafetyWebUseCase.getWalkSafety(loginActive.memberId(), planId);
        return ResponseEntity.ok().body(Response.success(response));
    }
}

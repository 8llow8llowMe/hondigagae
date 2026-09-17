package com.hondigagae.domainlayer.plan.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.SharedPlanResponse;
import com.hondigagae.domainlayer.plan.application.port.in.PlanShareLinkWebUseCase;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 공유 링크로 일정을 여는 <b>비인증</b> API (이슈 #627).
 *
 * <h2>왜 접두어를 따로 두는가</h2>
 *
 * {@code /api/v1/plans/**} 아래 두면 "인증이 필요한 일정 API" 와 "토큰만으로 열리는 API" 가 한
 * 경로 트리에 섞인다. 게이트웨이·보안 설정을 나중에 경로 기준으로 조일 때 그 구분이 없으면
 * 공개 엔드포인트 하나 때문에 트리 전체를 열어 두게 된다. 접두어를 나누면 "이 접두어는 공개" 가
 * 경로만 보고 읽힌다.
 *
 * <h2>permitAll 은 어떻게 걸리는가</h2>
 *
 * {@code ResourceServerSecurityConfigurer} 가 이미 {@code anyRequest().permitAll()} 이고 인증은
 * 메서드 어노테이션으로만 건다. 그래서 <b>{@code @PreAuthorize} 를 쓰지 않는 것이 곧 공개</b>다.
 * 같은 이유로 이 파일에는 {@code MemberLoginActive} 도 {@code @SecurityRequirement} 도 없다 —
 * 인증 주체를 여기서 해석할 일이 없고, Swagger 에 자물쇠를 띄우면 "로그인해야 되는 API" 로 읽힌다.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/shared-plans")
@Tag(name = "공유된 여행 일정", description = "공유 링크 토큰으로 일정을 읽는 비인증 API를 제공합니다.")
public class SharedPlanWebController {

    private final PlanShareLinkWebUseCase planShareLinkWebUseCase;

    @Operation(summary = "공유된 여행 일정 조회",
        description = "공유 링크 토큰으로 일정을 읽기 전용으로 조회합니다. **로그인이 필요 없습니다.**\n\n"
            + "일정 주인만 쓰는 값(일정 아이디·반려견 아이디·예산·항목 메모·방문 체크)은 내려가지 않습니다.\n\n"
            + "실패는 둘로 갈립니다 — 없는 토큰·폐기된 링크·삭제된 일정·초안으로 되돌린 일정은 모두 "
            + "`PLAN_023` 404 로 같게 답하고(어느 쪽인지 알려 주지 않습니다), 만료만 `PLAN_024` 410 입니다. "
            + "410 을 받으면 링크를 만든 사람에게 새 링크를 요청하세요.\n\n"
            + "**필수: token (경로).**\n\n"
            + "호출 예\n"
            + "- `GET /api/v1/shared-plans/b3RoZXJfdG9rZW5fZXhhbXBsZV92YWx1ZV8wMTIzNDU2Nzg`")
    @GetMapping("/{token}")
    public ResponseEntity<Response<SharedPlanResponse>> getSharedPlan(
        @Parameter(description = "[필수] 공유 토큰 (URL-safe Base64 43자). 발급 응답의 token 을 그대로 씁니다", required = true,
            example = "b3RoZXJfdG9rZW5fZXhhbXBsZV92YWx1ZV8wMTIzNDU2Nzg") @PathVariable String token
    ) {
        SharedPlanResponse response = planShareLinkWebUseCase.getSharedPlan(token);
        return ResponseEntity.ok().body(Response.success(response));
    }
}

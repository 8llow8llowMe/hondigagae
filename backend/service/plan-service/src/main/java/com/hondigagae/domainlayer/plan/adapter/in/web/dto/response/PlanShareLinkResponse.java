package com.hondigagae.domainlayer.plan.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import lombok.Builder;

@Builder
@Schema(description = "일정 공유 링크 응답 DTO (일정 주인만 받는다)")
public record PlanShareLinkResponse(

    @Schema(description = "일정 아이디", example = "1234567890123456789")
    String planId,

    @Schema(
        description = "공유 토큰. 공개 조회 주소는 `/api/v1/shared-plans/{token}` 이다. "
            + "토큰 자체가 열람 권한이므로 로그·분석 도구에 그대로 싣지 않는다",
        example = "b3RoZXJfdG9rZW5fZXhhbXBsZV92YWx1ZV8wMTIzNDU2Nzg")
    String token,

    @Schema(description = "만료 시각 (발급 시각 + 30일). 지나면 공개 조회가 410 으로 막힌다", example = "2026-10-17T10:30:00")
    LocalDateTime expiresAt
) {
}

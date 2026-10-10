package com.hondigagae.domainlayer.auth.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import lombok.Builder;

@Builder
@Schema(description = "로그인 기기(세션) 항목 DTO")
public record AuthSessionItem(

    @Schema(description = "세션 아이디 (개별 로그아웃에 사용)", example = "3f2a9c11-0e4b-4a1f-9c3d-0b8e2f7a5d61")
    String sessionId,

    @Schema(description = "마지막 토큰 갱신 시각", example = "2026-09-01T09:30:00Z")
    Instant lastRefreshedAt,

    @Schema(description = "지금 요청을 보낸 기기인지. refresh 쿠키가 없으면 판별할 수 없어 false", example = "true")
    boolean current
) {

}

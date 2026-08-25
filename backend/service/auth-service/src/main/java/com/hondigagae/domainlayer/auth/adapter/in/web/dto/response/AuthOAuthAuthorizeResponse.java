package com.hondigagae.domainlayer.auth.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "소셜 로그인 인가 URL 응답 DTO")
public record AuthOAuthAuthorizeResponse(

    @Schema(description = "provider 인가 페이지로 리다이렉트할 URL (CSRF 방어용 state 포함)",
        example = "https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=...&state=...")
    String authorizationUrl
) {

}

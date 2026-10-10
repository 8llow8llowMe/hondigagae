package com.hondigagae.domainlayer.auth.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "토큰 재발급 응답 DTO")
public record TokenReissueResponse(

    @Schema(description = "JWT 액세스 토큰", example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    String accessToken
) {

}

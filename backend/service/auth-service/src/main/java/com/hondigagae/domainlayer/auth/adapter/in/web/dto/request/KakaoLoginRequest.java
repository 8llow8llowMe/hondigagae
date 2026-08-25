package com.hondigagae.domainlayer.auth.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.auth.application.exception.AuthValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "카카오 로그인 요청 DTO")
public record KakaoLoginRequest(

    @Schema(description = "카카오가 콜백으로 전달한 인가코드", example = "q1w2e3r4...")
    @NotBlank(message = AuthValidationMessage.AUTH_CODE_REQUIRED)
    String code,

    @Schema(description = "인가 URL 생성 시 발급된 state", example = "0f8a3c...")
    @NotBlank(message = AuthValidationMessage.STATE_REQUIRED)
    String state
) {

}

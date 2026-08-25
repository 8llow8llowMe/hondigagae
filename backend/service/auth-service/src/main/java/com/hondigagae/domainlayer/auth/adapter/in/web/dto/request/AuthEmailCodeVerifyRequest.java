package com.hondigagae.domainlayer.auth.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.auth.application.exception.AuthValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "이메일 인증코드 검증 요청 DTO")
public record AuthEmailCodeVerifyRequest(

    @Schema(description = "인증코드를 받은 이메일 주소", example = "user@example.com")
    @NotBlank(message = AuthValidationMessage.EMAIL_REQUIRED)
    @Email(message = AuthValidationMessage.EMAIL_FORMAT_INVALID)
    String email,

    @Schema(description = "메일로 받은 인증코드", example = "A3K7MP2X")
    @NotBlank(message = AuthValidationMessage.EMAIL_CODE_REQUIRED)
    String code
) {

}

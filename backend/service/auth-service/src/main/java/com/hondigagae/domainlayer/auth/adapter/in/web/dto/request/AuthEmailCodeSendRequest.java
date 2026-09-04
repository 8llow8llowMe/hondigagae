package com.hondigagae.domainlayer.auth.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.auth.application.exception.AuthValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "이메일 인증코드 발송 요청 DTO")
public record AuthEmailCodeSendRequest(

    @Schema(description = "인증코드를 받을 이메일 주소", example = "user@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = AuthValidationMessage.EMAIL_REQUIRED)
    @Email(message = AuthValidationMessage.EMAIL_FORMAT_INVALID)
    String email
) {

}

package com.hondigagae.domainlayer.auth.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.auth.application.exception.AuthValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "비밀번호 재설정 코드 발송 요청 DTO")
public record AuthPasswordResetCodeSendRequest(

    @Schema(description = "가입한 이메일", example = "user@example.com")
    @NotBlank(message = AuthValidationMessage.EMAIL_REQUIRED)
    @Email(message = AuthValidationMessage.EMAIL_FORMAT_INVALID)
    String email
) {

}

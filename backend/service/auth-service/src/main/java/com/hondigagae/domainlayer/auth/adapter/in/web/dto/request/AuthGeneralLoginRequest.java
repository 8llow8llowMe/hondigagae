package com.hondigagae.domainlayer.auth.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.auth.application.exception.AuthValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "일반 로그인 요청 DTO")
public record AuthGeneralLoginRequest(

    @Schema(description = "이메일 주소", example = "user@example.com")
    @NotBlank(message = AuthValidationMessage.EMAIL_REQUIRED)
    @Email(message = AuthValidationMessage.EMAIL_FORMAT_INVALID)
    String email,

    @Schema(description = "비밀번호", example = "password123!")
    @NotBlank(message = AuthValidationMessage.PASSWORD_REQUIRED)
    String password
) {

}

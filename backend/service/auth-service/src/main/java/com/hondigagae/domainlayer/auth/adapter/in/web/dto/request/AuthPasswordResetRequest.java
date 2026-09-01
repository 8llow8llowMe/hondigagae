package com.hondigagae.domainlayer.auth.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.auth.application.exception.AuthValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "비밀번호 재설정 요청 DTO")
public record AuthPasswordResetRequest(

    @Schema(description = "가입한 이메일", example = "user@example.com")
    @NotBlank(message = AuthValidationMessage.EMAIL_REQUIRED)
    @Email(message = AuthValidationMessage.EMAIL_FORMAT_INVALID)
    String email,

    @Schema(description = "메일로 받은 재설정 인증코드", example = "A2B3C4D5")
    @NotBlank(message = AuthValidationMessage.EMAIL_CODE_REQUIRED)
    String code,

    @Schema(description = "새 비밀번호 (영문자, 숫자, 특수문자 포함 8~20자)", example = "newPassword456!")
    @NotBlank(message = AuthValidationMessage.NEW_PASSWORD_REQUIRED)
    @Size(min = 8, max = 20, message = AuthValidationMessage.PASSWORD_LENGTH_INVALID)
    @Pattern(
        regexp = AuthValidationMessage.PASSWORD_REGEXP,
        message = AuthValidationMessage.PASSWORD_PATTERN_INVALID
    )
    String newPassword
) {

}

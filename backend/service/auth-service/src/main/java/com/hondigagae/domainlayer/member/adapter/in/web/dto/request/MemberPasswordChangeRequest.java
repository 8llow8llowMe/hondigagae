package com.hondigagae.domainlayer.member.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.member.application.exception.MemberValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "비밀번호 변경 요청 DTO")
public record MemberPasswordChangeRequest(

    @Schema(description = "현재 비밀번호", example = "password123!")
    @NotBlank(message = MemberValidationMessage.CURRENT_PASSWORD_REQUIRED)
    String currentPassword,

    @Schema(description = "새 비밀번호 (영문자, 숫자, 특수문자 포함 8~20자)", example = "newPassword456!")
    @NotBlank(message = MemberValidationMessage.NEW_PASSWORD_REQUIRED)
    @Size(min = 8, max = 20, message = MemberValidationMessage.PASSWORD_LENGTH_INVALID)
    @Pattern(
        regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[!@#$%^&*()\\-_=+\\[\\]{};:'\",.<>/?\\\\|])\\S+$",
        message = MemberValidationMessage.PASSWORD_PATTERN_INVALID
    )
    String newPassword
) {

}

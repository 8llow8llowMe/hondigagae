package com.hondigagae.domainlayer.member.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.member.application.exception.MemberValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "비밀번호 최초 설정 요청 DTO (소셜 전용 계정에 이메일 로그인 수단 추가)")
public record MemberPasswordSetupRequest(

    @Schema(description = "새 비밀번호 (영문자, 숫자, 특수문자 포함 8~20자)", example = "newPassword456!")
    @NotBlank(message = MemberValidationMessage.NEW_PASSWORD_REQUIRED)
    @Size(min = 8, max = 20, message = MemberValidationMessage.PASSWORD_LENGTH_INVALID)
    @Pattern(
        regexp = MemberValidationMessage.PASSWORD_REGEXP,
        message = MemberValidationMessage.PASSWORD_PATTERN_INVALID
    )
    String newPassword
) {

}

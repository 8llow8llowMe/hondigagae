package com.hondigagae.domainlayer.member.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.member.application.exception.MemberValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "일반 회원가입 요청 DTO")
public record MemberGeneralSignupRequest(

    @Schema(description = "이메일 주소", example = "user@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = MemberValidationMessage.EMAIL_REQUIRED)
    @Email(message = MemberValidationMessage.EMAIL_FORMAT_INVALID)
    String email,

    @Schema(description = "비밀번호 (영문자, 숫자, 특수문자 포함 8~20자)", example = "password123!", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = MemberValidationMessage.PASSWORD_REQUIRED)
    @Size(min = 8, max = 20, message = MemberValidationMessage.PASSWORD_LENGTH_INVALID)
    @Pattern(
        regexp = MemberValidationMessage.PASSWORD_REGEXP,
        message = MemberValidationMessage.PASSWORD_PATTERN_INVALID
    )
    String password,

    @Schema(description = "회원 이름", example = "홍길동", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = MemberValidationMessage.NAME_REQUIRED)
    @Size(max = 10, message = MemberValidationMessage.NAME_LENGTH_INVALID)
    String name,

    @Schema(description = "회원 닉네임", example = "길동짱", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = MemberValidationMessage.NICKNAME_REQUIRED)
    @Size(max = 10, message = MemberValidationMessage.NICKNAME_LENGTH_INVALID)
    String nickname
) {

}

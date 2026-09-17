package com.hondigagae.domainlayer.member.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.member.application.exception.MemberValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 동의·확인 플래그는 <b>primitive {@code boolean}</b> 이어야 한다. {@code @AssertTrue} 는 null 을
 * 유효로 보기 때문에, 래퍼 {@code Boolean} 을 쓰면 필드를 아예 빼고 보낸 요청이 검증을 통과해
 * 동의 없이 가입된다. primitive 면 Jackson 이 누락된 필드를 {@code false} 로 채우고
 * {@code @AssertTrue} 가 그대로 걸러낸다.
 */
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
    String nickname,

    @Schema(description = "이용약관 동의 여부. 필수 동의라 true 가 아니면 가입할 수 없습니다", example = "true", requiredMode = Schema.RequiredMode.REQUIRED)
    @AssertTrue(message = MemberValidationMessage.TERMS_AGREEMENT_REQUIRED)
    boolean termsAgreed,

    @Schema(description = "개인정보 처리방침 동의 여부. 필수 동의라 true 가 아니면 가입할 수 없습니다", example = "true", requiredMode = Schema.RequiredMode.REQUIRED)
    @AssertTrue(message = MemberValidationMessage.PRIVACY_AGREEMENT_REQUIRED)
    boolean privacyAgreed,

    @Schema(description = "만 14세 이상 확인 여부. 필수라 true 가 아니면 가입할 수 없습니다", example = "true", requiredMode = Schema.RequiredMode.REQUIRED)
    @AssertTrue(message = MemberValidationMessage.AGE_OVER_14_REQUIRED)
    boolean ageOver14Confirmed
) {

}

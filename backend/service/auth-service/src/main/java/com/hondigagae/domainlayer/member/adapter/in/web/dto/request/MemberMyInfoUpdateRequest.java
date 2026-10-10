package com.hondigagae.domainlayer.member.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.member.application.exception.MemberValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 프로필 이미지는 이 DTO 로 다루지 않는다. 임의 URL 을 회원 정보에 넣을 수 있으면
 * 외부 이미지를 우리 서비스인 것처럼 노출시킬 수 있어, 업로드/삭제 전용 API 로만 변경한다.
 */
@Schema(description = "내 회원 정보 수정 요청 DTO")
public record MemberMyInfoUpdateRequest(

    @Schema(description = "변경할 닉네임", example = "길동짱", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = MemberValidationMessage.NICKNAME_REQUIRED)
    @Size(max = 10, message = MemberValidationMessage.NICKNAME_LENGTH_INVALID)
    String nickname
) {

}

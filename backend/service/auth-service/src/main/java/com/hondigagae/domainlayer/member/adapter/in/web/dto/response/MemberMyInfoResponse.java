package com.hondigagae.domainlayer.member.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "내 회원 정보 응답 DTO")
public record MemberMyInfoResponse(

    // Snowflake ID는 자바스크립트 Number 정밀도(2^53)를 넘길 수 있어 문자열로 내린다.
    @Schema(description = "회원 아이디", example = "1234567890123456789")
    String memberId,

    @Schema(description = "이메일 (카카오 미동의 시 null)", example = "hondi@kakao.com")
    String email,

    @Schema(description = "닉네임", example = "몽실이집사")
    String nickname,

    @Schema(description = "프로필 이미지 URL", example = "https://k.kakaocdn.net/dn/profile.jpg")
    String profileImageUrl,

    @Schema(description = "회원 권한", example = "{\"code\":\"USER\",\"name\":\"일반 회원\",\"description\":\"일반 회원\"}")
    CodeNameDescriptionMetadata role
) {
}

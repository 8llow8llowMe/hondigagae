package com.hondigagae.domainlayer.member.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "회원 내 정보 조회 응답 DTO")
public record MemberMyInfoResponse(

    @Schema(description = "회원 아이디", example = "202507110001")
    String memberId,

    @Schema(description = "이메일 주소", example = "user@example.com")
    String email,

    @Schema(description = "회원 이름", example = "홍길동")
    String name,

    @Schema(description = "회원 닉네임", example = "길동이")
    String nickname,

    @Schema(description = "프로필 이미지 URL", example = "https://cdn.tripmarble.com/profile.jpg")
    String profileImageUrl,

    @Schema(description = "회원 권한 메타데이터",
        example = "{\"code\": \"USER\", \"name\": \"일반 회원\", \"description\": \"일반 회원 권한입니다.\"}")
    CodeNameDescriptionMetadata role,

    @Schema(description = "소셜 로그인 제공자 (일반 계정이면 null)", example = "KAKAO", nullable = true)
    String provider,

    @Schema(description = "비밀번호 설정 여부 — provider 와 조합해 계정 상태를 구분한다 (true+null=일반, false+KAKAO=소셜 전용, true+KAKAO=연결됨)",
        example = "true")
    boolean hasPassword
) {

}

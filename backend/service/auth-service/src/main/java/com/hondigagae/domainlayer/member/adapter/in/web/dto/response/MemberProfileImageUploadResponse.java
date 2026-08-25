package com.hondigagae.domainlayer.member.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "프로필 이미지 업로드 응답 DTO")
public record MemberProfileImageUploadResponse(

    @Schema(description = "저장된 오브젝트 키 (서버 내부 식별자)",
        example = "members/profiles/202507110001/2026/08/3f2a9c11-0e4b-4a1f-9c3d-0b8e2f7a5d61.png")
    String profileImageKey,

    @Schema(description = "프로필 이미지 공개 URL",
        example = "https://minio.hondigagae.com/hondigagae/members/profiles/202507110001/2026/08/3f2a9c11-0e4b-4a1f-9c3d-0b8e2f7a5d61.png")
    String profileImageUrl
) {

}

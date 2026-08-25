package com.hondigagae.domainlayer.member.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberMyInfoResponse;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberProfileImageUploadResponse;
import com.hondigagae.domainlayer.member.application.info.MemberMyInfo;
import com.hondigagae.security.common.enums.SecurityRole;
import com.hondigagae.storage.client.ObjectStorageClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MemberPresenter {

    private final ObjectStorageClient objectStorageClient;

    public MemberMyInfoResponse toMyInfoResponse(MemberMyInfo info) {
        SecurityRole role = info.role();
        return MemberMyInfoResponse.builder()
            .memberId(String.valueOf(info.memberId()))
            .email(info.email())
            .name(info.name())
            .nickname(info.nickname())
            .profileImageUrl(resolveProfileImageUrl(info))
            .role(CodeNameDescriptionMetadata.of(role.name(), role.getDisplayName(), role.getDisplayName()))
            .provider(info.provider() == null ? null : info.provider().name())
            .build();
    }

    public MemberProfileImageUploadResponse toProfileImageUploadResponse(MemberMyInfo info) {
        return MemberProfileImageUploadResponse.builder()
            .profileImageKey(info.profileImageKey())
            .profileImageUrl(resolveProfileImageUrl(info))
            .build();
    }

    /**
     * 직접 업로드본이 있으면 저장된 키로 공개 URL 을 조립하고, 없으면 소셜 제공자 URL 을 그대로 쓴다.
     * URL 을 DB 에 넣지 않으므로 스토리지 도메인이 바뀌어도 응답만 달라진다.
     */
    private String resolveProfileImageUrl(MemberMyInfo info) {
        if (info.profileImageKey() != null && !info.profileImageKey().isBlank()) {
            return objectStorageClient.toPublicUrl(info.profileImageKey());
        }
        return info.profileImageUrl();
    }
}

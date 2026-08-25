package com.hondigagae.domainlayer.member.adapter.in.web.presenter;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberMyInfoResponse;
import com.hondigagae.domainlayer.member.application.info.MemberMyInfo;
import com.hondigagae.security.common.enums.SecurityRole;
import org.springframework.stereotype.Component;

@Component
public class MemberPresenter {

    public MemberMyInfoResponse toMyInfoResponse(MemberMyInfo info) {
        SecurityRole role = info.role();
        return MemberMyInfoResponse.builder()
            .memberId(String.valueOf(info.memberId()))
            .email(info.email())
            .nickname(info.nickname())
            .profileImageUrl(info.profileImageUrl())
            .role(CodeNameDescriptionMetadata.of(role.name(), role.getDisplayName(), role.getDisplayName()))
            .build();
    }
}

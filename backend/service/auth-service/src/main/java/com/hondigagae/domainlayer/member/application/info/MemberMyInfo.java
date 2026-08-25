package com.hondigagae.domainlayer.member.application.info;

import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.security.common.enums.SecurityRole;
import lombok.Builder;

@Builder
public record MemberMyInfo(
    long memberId,
    String email,
    String nickname,
    String profileImageUrl,
    SecurityRole role
) {

    public static MemberMyInfo from(Member member) {
        return MemberMyInfo.builder()
            .memberId(member.id())
            .email(member.email())
            .nickname(member.nickname())
            .profileImageUrl(member.profileImageUrl())
            .role(member.role())
            .build();
    }
}

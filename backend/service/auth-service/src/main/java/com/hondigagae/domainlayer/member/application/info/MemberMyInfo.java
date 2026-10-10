package com.hondigagae.domainlayer.member.application.info;

import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.security.common.enums.SecurityRole;
import lombok.Builder;

@Builder
public record MemberMyInfo(
    long memberId,
    String email,
    String name,
    String nickname,
    // 소셜 제공자 외부 URL. 직접 업로드본이 있으면 null 이다.
    String profileImageUrl,
    // 직접 업로드본의 오브젝트 키. 공개 URL 조립은 Presenter 책임이다.
    String profileImageKey,
    SecurityRole role,
    OAuthProvider provider,
    // 비밀번호 설정 여부. FE가 (일반/소셜 전용/연결됨) 상태를 구분해 비밀번호 메뉴를 분기하는 데 쓴다.
    boolean hasPassword
) {

    public static MemberMyInfo from(Member member) {
        return MemberMyInfo.builder()
            .memberId(member.id())
            .email(member.email())
            .name(member.name())
            .nickname(member.nickname())
            .profileImageUrl(member.profileImageUrl())
            .profileImageKey(member.profileImageKey())
            .role(member.role())
            .provider(member.provider())
            .hasPassword(member.password() != null)
            .build();
    }
}

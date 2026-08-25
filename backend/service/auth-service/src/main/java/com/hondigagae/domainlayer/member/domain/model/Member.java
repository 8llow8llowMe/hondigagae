package com.hondigagae.domainlayer.member.domain.model;

import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.security.common.enums.SecurityRole;
import lombok.Builder;

/**
 * 회원 식별 기준은 kakaoId(카카오 회원번호)다. 이메일은 카카오 동의 항목이라 없을 수 있으며
 * 참고 정보로만 저장한다.
 */
@Builder
public record Member(
    long id,
    long kakaoId,
    String email,
    String nickname,
    String profileImageUrl,
    SecurityRole role,
    MemberStatus status
) {

    private static final String WITHDRAWN_MASK = "탈퇴회원";

    /**
     * 논리 탈퇴 상태로 전이한다. 개인정보 노출을 줄이기 위해 닉네임을 마스킹하고
     * 이메일/프로필 이미지를 제거한다. kakaoId는 유지되어 동일 카카오 계정 재가입이 차단된다.
     */
    public Member withdraw() {
        return toBuilder()
            .email(null)
            .nickname(WITHDRAWN_MASK)
            .profileImageUrl(null)
            .status(MemberStatus.WITHDRAWN)
            .build();
    }

    private MemberBuilder toBuilder() {
        return Member.builder()
            .id(id).kakaoId(kakaoId).email(email).nickname(nickname)
            .profileImageUrl(profileImageUrl).role(role).status(status);
    }
}

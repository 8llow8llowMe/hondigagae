package com.hondigagae.domainlayer.member.domain.model;

import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.security.common.enums.SecurityRole;
import lombok.Builder;

/**
 * 프로필 이미지는 출처가 두 가지라 필드를 나눠 둔다.
 * <ul>
 *   <li>{@code profileImageKey} — 우리 스토리지(MinIO)에 직접 업로드한 객체 키. 도메인이 바뀌어도
 *       데이터를 마이그레이션할 필요가 없도록 URL 이 아니라 키를 저장한다.</li>
 *   <li>{@code profileImageUrl} — 소셜 로그인 제공자(카카오/네이버)가 준 외부 CDN URL.</li>
 * </ul>
 * 둘은 배타적이며 표시 우선순위는 key > url 이다 (직접 올린 이미지가 항상 이긴다).
 */
@Builder
public record Member(
    long id,
    String email,
    String password,
    String name,
    String nickname,
    String profileImageUrl,
    String profileImageKey,
    SecurityRole role,
    // 소셜 가입/연결 제공자. null이면 일반(이메일+비밀번호) 계정.
    OAuthProvider provider,
    MemberStatus status
) {

    private static final String WITHDRAWN_MASK = "탈퇴회원";

    /**
     * 논리 탈퇴 상태로 전이한다. 개인정보 노출을 줄이기 위해 이름/닉네임을 마스킹하고
     * 프로필 이미지와 비밀번호 해시를 제거한다. email은 유지되어 동일 이메일 재가입이 차단된다.
     */
    public Member withdraw() {
        return toBuilder().password(null).name(WITHDRAWN_MASK).nickname(WITHDRAWN_MASK)
            .profileImageUrl(null).profileImageKey(null)
            .status(MemberStatus.WITHDRAWN).build();
    }

    /**
     * 닉네임만 변경한다. 프로필 이미지는 전용 API(업로드/삭제)로만 바뀐다.
     */
    public Member updateNickname(String nickname) {
        return toBuilder().nickname(nickname).build();
    }

    /**
     * 직접 업로드한 이미지로 교체한다. 외부(소셜) URL 은 함께 비운다.
     */
    public Member updateProfileImageKey(String profileImageKey) {
        return toBuilder().profileImageKey(profileImageKey).profileImageUrl(null).build();
    }

    public Member removeProfileImage() {
        return toBuilder().profileImageKey(null).profileImageUrl(null).build();
    }

    public Member changePassword(String encodedPassword) {
        return toBuilder().password(encodedPassword).build();
    }

    /**
     * 비밀번호를 제거해 소셜 전용 계정으로 전환한다.
     * 호출 전 소셜 연결 여부 검증은 프로세서 책임이다 (마지막 로그인 수단 제거 방지).
     */
    public Member removePassword() {
        return toBuilder().password(null).build();
    }

    /**
     * 일반 계정을 소셜 계정으로 연결한다. (동일 이메일의 소셜 로그인 시 자동 연결 정책)
     */
    public Member withProvider(OAuthProvider newProvider) {
        return toBuilder().provider(newProvider).build();
    }

    private MemberBuilder toBuilder() {
        return Member.builder()
            .id(id).email(email).password(password).name(name).nickname(nickname)
            .profileImageUrl(profileImageUrl).profileImageKey(profileImageKey)
            .role(role).provider(provider).status(status);
    }
}

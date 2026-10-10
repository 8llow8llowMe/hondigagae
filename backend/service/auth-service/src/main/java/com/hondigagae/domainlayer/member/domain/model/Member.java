package com.hondigagae.domainlayer.member.domain.model;

import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.security.common.enums.SecurityRole;
import java.time.LocalDateTime;
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
    MemberStatus status,
    // 탈퇴 시각. ACTIVE/SUSPENDED 회원은 null 이다. 보존 기간 경과 판정의 유일한 기준점이다.
    LocalDateTime withdrawnAt
) {

    private static final String WITHDRAWN_MASK = "탈퇴회원";

    /**
     * 논리 탈퇴 상태로 전이한다. 개인정보 노출을 줄이기 위해 이름/닉네임을 마스킹하고
     * 프로필 이미지와 비밀번호 해시를 제거하며, <b>email 을 되돌릴 수 없는 다이제스트로 치환한다</b>.
     *
     * <p>원문을 남기지 않는 이유는 처리 목적이 끝난 개인정보를 무기한 보관하지 않기 위해서다
     * (개인정보 보호법 제21조). 동일 이메일 재가입 차단은 원문 비교 대신 <b>다이제스트 비교</b>로
     * 그대로 달성된다 — 같은 이메일은 항상 같은 다이제스트로 계산되기 때문이다.
     *
     * <p><b>도메인이 다이제스트를 계산하지 않는다.</b> 계산에는 설정으로 주입되는 비밀값(pepper)이
     * 필요한데, 도메인이 인프라 비밀을 알기 시작하면 순수 값 객체가 아니게 되고 테스트도 설정에
     * 묶인다. 계산은 애플리케이션 계층(프로세서 + {@code WithdrawnEmailHasher})이 하고 여기에는
     * 결과 값만 들어온다. 같은 이유로 탈퇴 시각도 밖에서 받는다.
     *
     * @param emailDigest 정규화된 이메일의 HMAC 다이제스트 (hex 64자)
     * @param withdrawnAt 탈퇴 시각. 보존 기간(30일) 경과 판정에 쓰인다
     */
    public Member withdraw(String emailDigest, LocalDateTime withdrawnAt) {
        return toBuilder().email(emailDigest).password(null).name(WITHDRAWN_MASK).nickname(WITHDRAWN_MASK)
            .profileImageUrl(null).profileImageKey(null)
            .status(MemberStatus.WITHDRAWN).withdrawnAt(withdrawnAt).build();
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
            .role(role).provider(provider).status(status).withdrawnAt(withdrawnAt);
    }
}

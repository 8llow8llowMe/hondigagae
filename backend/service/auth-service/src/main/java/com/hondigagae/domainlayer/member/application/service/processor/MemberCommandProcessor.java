package com.hondigagae.domainlayer.member.application.service.processor;

import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.domainlayer.member.application.info.MemberMyInfo;
import com.hondigagae.domainlayer.member.application.info.MemberProfileImageChangeResult;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.domain.model.Member;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MemberCommandProcessor {

    private final MemberQueryProcessor memberQueryProcessor;
    private final MemberRepositoryPort memberRepositoryPort;
    private final PasswordEncoder passwordEncoder;

    /**
     * 논리 탈퇴. 남아 있던 프로필 이미지 키를 함께 반환해 호출부가 커밋 후 객체를 정리하게 한다.
     */
    public String withdraw(long memberId) {
        Member member = memberQueryProcessor.getActiveMember(memberId);
        String previousObjectKey = member.profileImageKey();
        memberRepositoryPort.save(member.withdraw());
        return previousObjectKey;
    }

    public MemberMyInfo updateMyInfo(long memberId, String nickname) {
        Member member = memberQueryProcessor.getActiveMember(memberId);
        Member updated = memberRepositoryPort.save(member.updateNickname(nickname));
        return MemberMyInfo.from(updated);
    }

    /**
     * 업로드된 오브젝트 키를 회원에 반영한다. 실제 업로드는 트랜잭션 밖에서 이미 끝난 상태다.
     */
    // 파사드가 스토리지 I/O 를 트랜잭션 밖에 두므로(업로드 → DB 반영 → 회수) DB 구간은 여기서 경계를 연다.
    @Transactional
    public MemberProfileImageChangeResult updateProfileImage(long memberId, String objectKey) {
        Member member = memberQueryProcessor.getActiveMember(memberId);
        String previousObjectKey = member.profileImageKey();
        Member updated = memberRepositoryPort.save(member.updateProfileImageKey(objectKey));
        return new MemberProfileImageChangeResult(MemberMyInfo.from(updated), previousObjectKey);
    }

    @Transactional
    public MemberProfileImageChangeResult removeProfileImage(long memberId) {
        Member member = memberQueryProcessor.getActiveMember(memberId);
        String previousObjectKey = member.profileImageKey();
        Member updated = memberRepositoryPort.save(member.removeProfileImage());
        return new MemberProfileImageChangeResult(MemberMyInfo.from(updated), previousObjectKey);
    }

    public void changePassword(long memberId, String currentPassword, String newPassword) {
        Member member = memberQueryProcessor.getActiveMember(memberId);

        // 소셜 계정은 비밀번호가 없으므로 명확한 사유로 거부한다. (최초 설정은 setupPassword 가 담당)
        if (member.password() == null) {
            throw new MemberException(MemberErrorCode.SOCIAL_ACCOUNT_PASSWORD_UNSUPPORTED);
        }

        if (!passwordEncoder.matches(currentPassword, member.password())) {
            throw new MemberException(MemberErrorCode.NOT_MATCH_PASSWORD);
        }

        memberRepositoryPort.save(member.changePassword(passwordEncoder.encode(newPassword)));
    }

    /**
     * 소셜 전용 계정(비밀번호 없음)에 비밀번호를 최초 설정해 이메일 로그인 수단을 추가한다.
     * 로그인된 본인의 수단 "추가"라 기존 세션 위험과 무관하므로 세션 무효화는 하지 않는다.
     */
    public void setupPassword(long memberId, String newPassword) {
        Member member = memberQueryProcessor.getActiveMember(memberId);

        if (member.password() != null) {
            throw new MemberException(MemberErrorCode.PASSWORD_ALREADY_SET);
        }

        memberRepositoryPort.save(member.changePassword(passwordEncoder.encode(newPassword)));
    }

    /**
     * 비밀번호를 제거해 소셜 전용 계정으로 전환한다. 소셜이 연결된 계정만 허용한다 —
     * 일반 전용 계정의 비밀번호를 지우면 로그인 수단이 사라진다(마지막 수단 제거 방지).
     * 통보 메일에 쓸 수 있도록 전환된 회원을 반환한다.
     */
    public Member removePassword(long memberId) {
        Member member = memberQueryProcessor.getActiveMember(memberId);

        if (member.password() == null) {
            throw new MemberException(MemberErrorCode.SOCIAL_ACCOUNT_PASSWORD_UNSUPPORTED);
        }
        if (member.provider() == null) {
            throw new MemberException(MemberErrorCode.PASSWORD_REMOVAL_NOT_ALLOWED);
        }

        return memberRepositoryPort.save(member.removePassword());
    }
}

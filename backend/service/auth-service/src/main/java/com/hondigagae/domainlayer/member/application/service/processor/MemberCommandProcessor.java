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
    public MemberProfileImageChangeResult updateProfileImage(long memberId, String objectKey) {
        Member member = memberQueryProcessor.getActiveMember(memberId);
        String previousObjectKey = member.profileImageKey();
        Member updated = memberRepositoryPort.save(member.updateProfileImageKey(objectKey));
        return new MemberProfileImageChangeResult(MemberMyInfo.from(updated), previousObjectKey);
    }

    public MemberProfileImageChangeResult removeProfileImage(long memberId) {
        Member member = memberQueryProcessor.getActiveMember(memberId);
        String previousObjectKey = member.profileImageKey();
        Member updated = memberRepositoryPort.save(member.removeProfileImage());
        return new MemberProfileImageChangeResult(MemberMyInfo.from(updated), previousObjectKey);
    }

    public void changePassword(long memberId, String currentPassword, String newPassword) {
        Member member = memberQueryProcessor.getActiveMember(memberId);

        // 소셜 계정은 비밀번호가 없으므로 명확한 사유로 거부한다.
        if (member.password() == null) {
            throw new MemberException(MemberErrorCode.SOCIAL_ACCOUNT_PASSWORD_UNSUPPORTED);
        }

        if (!passwordEncoder.matches(currentPassword, member.password())) {
            throw new MemberException(MemberErrorCode.NOT_MATCH_PASSWORD);
        }

        memberRepositoryPort.save(member.changePassword(passwordEncoder.encode(newPassword)));
    }
}

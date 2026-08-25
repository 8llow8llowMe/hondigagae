package com.hondigagae.domainlayer.member.application.service.processor;

import com.hondigagae.domainlayer.member.application.command.MemberGeneralSignupCommand;
import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.application.port.out.SignupEmailVerificationPort;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.util.Locale;
import com.hondigagae.security.common.enums.SecurityRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MemberGeneralSignupProcessor {

    private final MemberRepositoryPort memberRepositoryPort;
    private final SignupEmailVerificationPort signupEmailVerificationPort;
    private final PasswordEncoder passwordEncoder;
    private final SnowflakeIdGenerator snowflakeIdGenerator;

    public void generalSignup(MemberGeneralSignupCommand command) {
        // 이메일은 인증 플래그 키(Redis)와 정합되도록 trim + 소문자로 정규화해 저장/검증한다.
        String email = command.email().trim().toLowerCase(Locale.ROOT);

        // 1. 이메일 인증 완료 여부 검증
        validateEmailVerified(email);

        // 2. 이메일 중복 검증
        validateEmailNotExists(email);

        // 3. 회원 생성 및 저장 후 인증 플래그 소비
        Member member = createMember(command, email);
        memberRepositoryPort.save(member);
        signupEmailVerificationPort.consume(email);
    }

    private void validateEmailVerified(String email) {
        if (!signupEmailVerificationPort.isVerified(email)) {
            throw new MemberException(MemberErrorCode.EMAIL_NOT_VERIFIED);
        }
    }

    private void validateEmailNotExists(String email) {
        // 계정 상태(탈퇴/정지) 노출을 막기 위해 상태와 무관하게 동일한 응답을 반환한다.
        if (memberRepositoryPort.findByEmail(email).isPresent()) {
            throw new MemberException(MemberErrorCode.EXIST_MEMBER_EMAIL, email);
        }
    }

    private Member createMember(MemberGeneralSignupCommand command, String email) {
        return Member.builder()
            .id(snowflakeIdGenerator.generateId())
            .email(email)
            .password(passwordEncoder.encode(command.password()))
            .name(command.name())
            .nickname(command.nickname())
            .profileImageUrl(null)
            .role(SecurityRole.USER)
            .status(MemberStatus.ACTIVE)
            .build();
    }
}

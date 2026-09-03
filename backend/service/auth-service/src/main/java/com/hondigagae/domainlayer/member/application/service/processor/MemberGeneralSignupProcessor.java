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

    /**
     * 개발/테스트 전용 즉시 가입.
     *
     * <p><b>이메일 인증 게이트만 건너뛴다.</b> 정규화·중복 검증·비밀번호 인코딩·권한·상태는
     * 일반 가입과 같은 코드를 탄다 - 검증을 함께 느슨하게 하면 개발 계정만 통과하는 값이
     * 생겨서, 정작 운영에서 막히는 입력을 개발에서 못 잡는다.
     *
     * <p>노출을 막는 책임은 이 메서드가 아니라 {@code @Profile("!prod")} 가 붙은 파사드와
     * 컨트롤러에 있다. 여기서 프로파일을 보지 않는 이유는, 프로세서가 실행 환경을 알기 시작하면
     * "어느 환경에서 어떤 규칙이 도는지"가 도메인 로직 안으로 흩어지기 때문이다.
     *
     * @return 만들어진 회원. 생성된 아이디를 호출부가 응답에 실을 수 있게 돌려준다
     */
    public Member devSignup(MemberGeneralSignupCommand command) {
        String email = command.email().trim().toLowerCase(Locale.ROOT);
        validateEmailNotExists(email);
        return memberRepositoryPort.save(createMember(command, email));
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

package com.hondigagae.domainlayer.member.application.service.processor;

import com.hondigagae.domainlayer.member.application.command.MemberGeneralSignupCommand;
import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.application.port.out.SignupEmailVerificationPort;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.model.Member;
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
    private final MemberConsentProcessor memberConsentProcessor;
    private final SignupEmailVerificationPort signupEmailVerificationPort;
    private final PasswordEncoder passwordEncoder;
    private final SnowflakeIdGenerator snowflakeIdGenerator;

    public void generalSignup(MemberGeneralSignupCommand command) {
        // 이메일은 인증 플래그 키(Redis)와 정합되도록 trim + 소문자로 정규화해 저장/검증한다.
        String email = command.email().trim().toLowerCase(Locale.ROOT);

        // 1. 필수 동의 검증
        validateConsented(command);

        // 2. 이메일 인증 완료 여부 검증
        validateEmailVerified(email);

        // 3. 이메일 중복 검증
        validateEmailNotExists(email);

        // 4. 회원 생성 및 저장 후 동의 이력 기록, 마지막으로 인증 플래그 소비
        //    동의 이력은 회원 저장 뒤에 남긴다 — memberId 가 있어야 하고, 중복 이메일로 막힌
        //    요청이 동의 이력만 남기는 일도 없어야 한다.
        Member member = memberRepositoryPort.save(createMember(command, email));
        memberConsentProcessor.recordSignupConsents(member.id());
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
     * <p>같은 이유로 <b>동의도 일반 가입과 똑같이 요구하고 똑같이 이력을 남긴다.</b> 개발 계정만
     * 이력이 비어 있으면, 이력을 읽는 쪽(조회·통계·탈퇴 처리)이 "없을 수도 있는 값"을 다루게 되고
     * 그 분기는 운영에서 검증되지 않는다.
     *
     * @return 만들어진 회원. 생성된 아이디를 호출부가 응답에 실을 수 있게 돌려준다
     */
    public Member devSignup(MemberGeneralSignupCommand command) {
        String email = command.email().trim().toLowerCase(Locale.ROOT);
        validateConsented(command);
        validateEmailNotExists(email);

        Member member = memberRepositoryPort.save(createMember(command, email));
        memberConsentProcessor.recordSignupConsents(member.id());
        return member;
    }

    /**
     * 동의 없이 가입 경로로 들어오지 못하게 막는다.
     *
     * <p>web 경계의 {@code @AssertTrue}(MEMBER_115/116)와 <b>중복 검사가 아니다.</b> 그쪽이
     * 지키는 것은 "요청 형식이 올바른가"이고, 여기서 지키는 것은 <b>"우리가 남기는 동의 행이
     * 실제 동의를 반영한다"는 불변식</b>이다. 가입 성공 경로가 무조건 동의 2행을 남기기 때문에,
     * 이 검사가 없으면 DTO 를 거치지 않는 호출자가 생기는 순간 동의하지 않은 회원의 동의 이력이
     * 만들어진다 — 이력의 신뢰성이 통째로 무너지는 방식이다. 소셜 경로도 같은 이유로
     * {@code OAuthLoginProcessor} 안에서 한 번 더 확인한다.
     */
    private void validateConsented(MemberGeneralSignupCommand command) {
        if (!command.termsAgreed() || !command.privacyAgreed()) {
            throw new MemberException(MemberErrorCode.CONSENT_REQUIRED);
        }
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

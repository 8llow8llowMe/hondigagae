package com.hondigagae.domainlayer.member.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.member.application.command.MemberGeneralSignupCommand;
import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.domainlayer.member.application.port.out.MemberConsentRepositoryPort;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.application.port.out.SignupEmailVerificationPort;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.domainlayer.member.domain.model.MemberConsent;
import com.hondigagae.global.properties.LegalDocumentProperties;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * 일반 가입의 동의 처리.
 *
 * <p>이력의 <b>내용</b>(항목·버전·시각)은 {@code MemberConsentProcessorTest} 가 본다. 여기서
 * 보는 것은 <b>언제 남기고 언제 남기지 않는가</b> 다 — 가입에 성공한 회원에게만, 그리고 동의한
 * 요청에만 남아야 한다.
 */
class MemberGeneralSignupProcessorTest {

    private static final String EMAIL = "tester@example.com";
    private static final String PASSWORD = "Password1!";

    private StubMemberRepositoryPort memberRepositoryPort;
    private RecordingConsentRepositoryPort consentRepositoryPort;
    private StubEmailVerificationPort emailVerificationPort;
    private MemberGeneralSignupProcessor processor;

    @BeforeEach
    void setUp() {
        memberRepositoryPort = new StubMemberRepositoryPort();
        consentRepositoryPort = new RecordingConsentRepositoryPort();
        emailVerificationPort = new StubEmailVerificationPort();
        // 동의 프로세서는 스텁으로 바꾸지 않고 실물을 쓴다 — 두 가입 경로가 같은 규칙을 탄다는
        // 것이 이 구조의 요점이라, 그 연결을 테스트에서 끊으면 검증할 것이 남지 않는다.
        MemberConsentProcessor consentProcessor = new MemberConsentProcessor(
            consentRepositoryPort, new SnowflakeIdGenerator(1, 1), new LegalDocumentProperties("1.0", "1.2"));
        processor = new MemberGeneralSignupProcessor(
            memberRepositoryPort, consentProcessor, emailVerificationPort,
            new BCryptPasswordEncoder(4), new SnowflakeIdGenerator(1, 1));
    }

    @Test
    @DisplayName("가입에 성공한 회원에게 동의 이력이 남는다")
    void recordsConsentsForTheCreatedMember() {
        emailVerificationPort.markVerified(EMAIL);

        processor.generalSignup(command(true, true));

        long memberId = memberRepositoryPort.findByEmail(EMAIL).orElseThrow().id();
        assertThat(consentRepositoryPort.saved).hasSize(3);
        assertThat(consentRepositoryPort.saved).allSatisfy(
            consent -> assertThat(consent.memberId()).isEqualTo(memberId));
    }

    @Test
    @DisplayName("이용약관에 동의하지 않았으면 회원도 동의 이력도 남지 않는다")
    void rejectsWithoutTermsAgreement() {
        // web 경계의 @AssertTrue 와 중복이 아니다 — 여기서 지키는 것은 "동의 행이 실제 동의를
        // 반영한다"는 불변식이다. 이 검사가 없으면 DTO 를 거치지 않는 호출자가 생기는 순간
        // 동의하지 않은 회원의 동의 이력이 만들어진다.
        emailVerificationPort.markVerified(EMAIL);

        assertThatThrownBy(() -> processor.generalSignup(command(false, true)))
            .isInstanceOf(MemberException.class)
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.CONSENT_REQUIRED);

        assertThat(memberRepositoryPort.findByEmail(EMAIL)).isEmpty();
        assertThat(consentRepositoryPort.saved).isEmpty();
    }

    @Test
    @DisplayName("개인정보 처리방침에 동의하지 않았으면 회원도 동의 이력도 남지 않는다")
    void rejectsWithoutPrivacyAgreement() {
        emailVerificationPort.markVerified(EMAIL);

        assertThatThrownBy(() -> processor.generalSignup(command(true, false)))
            .isInstanceOf(MemberException.class)
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.CONSENT_REQUIRED);

        assertThat(memberRepositoryPort.findByEmail(EMAIL)).isEmpty();
        assertThat(consentRepositoryPort.saved).isEmpty();
    }

    @Test
    @DisplayName("만 14세 이상 확인이 없으면 회원도 이력도 남지 않는다")
    void rejectsWithoutAgeConfirmation() {
        emailVerificationPort.markVerified(EMAIL);

        assertThatThrownBy(() -> processor.generalSignup(command(true, true, false)))
            .isInstanceOf(MemberException.class)
            // 동의 누락(MEMBER_010)과 다른 코드여야 한다 — 프론트가 강조할 체크박스가 다르다.
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.AGE_REQUIREMENT_NOT_MET);

        assertThat(memberRepositoryPort.findByEmail(EMAIL)).isEmpty();
        assertThat(consentRepositoryPort.saved).isEmpty();
    }

    @Test
    @DisplayName("만 14세 확인 검사도 이메일 인증보다 먼저다 — 확인 없는 요청은 인증 플래그를 건드리지 않는다")
    void checksAgeBeforeTouchingVerificationFlag() {
        emailVerificationPort.markVerified(EMAIL);

        assertThatThrownBy(() -> processor.generalSignup(command(true, true, false)))
            .isInstanceOf(MemberException.class);

        assertThat(emailVerificationPort.isVerified(EMAIL)).isTrue();
    }

    @Test
    @DisplayName("동의 검사가 이메일 인증보다 먼저다 — 동의 없는 요청은 인증 플래그를 건드리지 않는다")
    void checksConsentBeforeTouchingVerificationFlag() {
        emailVerificationPort.markVerified(EMAIL);

        assertThatThrownBy(() -> processor.generalSignup(command(false, false)))
            .isInstanceOf(MemberException.class);

        // 소비됐다면 사용자는 "인증했는데 안 됐다"를 겪고 코드를 다시 받아야 한다.
        assertThat(emailVerificationPort.isVerified(EMAIL)).isTrue();
    }

    @Test
    @DisplayName("이메일 인증 전이면 회원도 동의 이력도 남지 않는다")
    void leavesNothingBehindWhenEmailNotVerified() {
        // 가입이 막힌 요청이 동의 이력만 남기면, 존재하지 않는 회원의 동의가 쌓인다.
        assertThatThrownBy(() -> processor.generalSignup(command(true, true)))
            .isInstanceOf(MemberException.class)
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.EMAIL_NOT_VERIFIED);

        assertThat(consentRepositoryPort.saved).isEmpty();
    }

    @Test
    @DisplayName("이메일 중복으로 막히면 동의 이력이 남지 않는다")
    void leavesNothingBehindWhenEmailDuplicated() {
        emailVerificationPort.markVerified(EMAIL);
        processor.generalSignup(command(true, true));
        consentRepositoryPort.saved.clear();
        // 첫 가입이 인증 플래그를 소비했으므로 다시 인증한 상태로 둔다 — 그래야 중복 검증까지 내려간다.
        emailVerificationPort.markVerified(EMAIL);

        assertThatThrownBy(() -> processor.generalSignup(command(true, true)))
            .isInstanceOf(MemberException.class)
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.EXIST_MEMBER_EMAIL);

        assertThat(consentRepositoryPort.saved).isEmpty();
    }

    // --- fixtures ---

    /** 문서 동의만 바꾸는 경우. 만 14세 확인은 전용 테스트가 따로 보므로 통과값으로 고정한다. */
    private MemberGeneralSignupCommand command(boolean termsAgreed, boolean privacyAgreed) {
        return command(termsAgreed, privacyAgreed, true);
    }

    private MemberGeneralSignupCommand command(boolean termsAgreed, boolean privacyAgreed, boolean ageOver14Confirmed) {
        return MemberGeneralSignupCommand.builder()
            .email(EMAIL).password(PASSWORD).name("테스터").nickname("테스터")
            .termsAgreed(termsAgreed).privacyAgreed(privacyAgreed).ageOver14Confirmed(ageOver14Confirmed)
            .build();
    }

    private static class RecordingConsentRepositoryPort implements MemberConsentRepositoryPort {

        private final List<MemberConsent> saved = new ArrayList<>();

        @Override
        public void saveAll(List<MemberConsent> consents) {
            saved.addAll(consents);
        }
    }

    private static class StubEmailVerificationPort implements SignupEmailVerificationPort {

        private final Set<String> verified = new HashSet<>();

        void markVerified(String email) {
            verified.add(email);
        }

        @Override
        public boolean isVerified(String email) {
            return verified.contains(email);
        }

        @Override
        public void consume(String email) {
            verified.remove(email);
        }
    }

    private static class StubMemberRepositoryPort implements MemberRepositoryPort {

        private final Map<Long, Member> members = new HashMap<>();

        @Override
        public Member save(Member domain) {
            members.put(domain.id(), domain);
            return domain;
        }

        @Override
        public Optional<Member> findByEmail(String email) {
            return members.values().stream().filter(member -> member.email().equals(email)).findFirst();
        }

        @Override
        public Optional<Member> findById(long memberId) {
            return Optional.ofNullable(members.get(memberId));
        }

        @Override
        public List<String> findAllProfileImageKeys() {
            return List.of();
        }
    }
}

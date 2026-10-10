package com.hondigagae.domainlayer.member.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.member.application.command.MemberGeneralSignupCommand;
import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.domainlayer.member.application.port.out.MemberConsentRepositoryPort;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.application.port.out.SignupEmailVerificationPort;
import com.hondigagae.domainlayer.member.application.service.support.WithdrawnEmailHasher;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.domainlayer.member.domain.model.MemberConsent;
import com.hondigagae.global.properties.LegalDocumentProperties;
import com.hondigagae.global.properties.WithdrawnEmailProperties;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import com.hondigagae.security.common.enums.SecurityRole;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 개발용 즉시 가입 검증.
 *
 * <p>이 기능의 위험은 "인증을 건너뛴다"가 아니라 <b>건너뛰는 김에 다른 것까지 느슨해지는 것</b>
 * 이다. 개발 계정만 통과하는 값이 생기면, 정작 운영에서 막히는 입력을 개발에서 못 잡는다.
 * 그래서 여기서 확인하는 것은 대부분 <b>여전히 막히는가</b> 다.
 */
class MemberDevSignupProcessorTest {

    private static final String PASSWORD = "Password1!";
    private static final String TEST_PEPPER = "dev-signup-test-pepper-0123456789abcdef";

    private PasswordEncoder passwordEncoder;
    private StubMemberRepositoryPort memberRepositoryPort;
    private RecordingConsentRepositoryPort consentRepositoryPort;
    private RecordingEmailVerificationPort emailVerificationPort;
    private MemberGeneralSignupProcessor processor;

    @BeforeEach
    void setUp() {
        // bcrypt strength 4 — 실제 인코딩 로직을 그대로 쓰면서 테스트 시간만 줄인다.
        passwordEncoder = new BCryptPasswordEncoder(4);
        memberRepositoryPort = new StubMemberRepositoryPort();
        consentRepositoryPort = new RecordingConsentRepositoryPort();
        emailVerificationPort = new RecordingEmailVerificationPort();
        // 동의 프로세서는 실물을 쓴다 — 개발 가입이 일반 가입과 같은 규칙을 탄다는 것이 요점이다.
        MemberConsentProcessor consentProcessor = new MemberConsentProcessor(
            consentRepositoryPort, new SnowflakeIdGenerator(1, 1), new LegalDocumentProperties("1.0", "1.2"));
        processor = new MemberGeneralSignupProcessor(
            memberRepositoryPort, consentProcessor, emailVerificationPort,
            new WithdrawnEmailHasher(new WithdrawnEmailProperties(TEST_PEPPER)), passwordEncoder,
            new SnowflakeIdGenerator(1, 1));
    }

    @Test
    @DisplayName("이메일 인증 없이 계정을 만든다")
    void createsMemberWithoutEmailVerification() {
        // 인증 플래그가 없는 상태다. 일반 가입이라면 여기서 막힌다.
        Member member = processor.devSignup(command("tester@example.com"));

        assertThat(member.id()).isPositive();
        assertThat(memberRepositoryPort.findByEmail("tester@example.com")).isPresent();
        assertThat(emailVerificationPort.verifiedChecks).isZero();
    }

    @Test
    @DisplayName("인증 플래그를 읽지도 소비하지도 않는다")
    void neverTouchesVerificationFlag() {
        // 소비까지 하면 나중에 일반 가입을 시도할 때 "인증했는데 안 됐다"가 된다.
        processor.devSignup(command("tester@example.com"));

        assertThat(emailVerificationPort.verifiedChecks).isZero();
        assertThat(emailVerificationPort.consumed).isEmpty();
    }

    @Test
    @DisplayName("이메일 중복은 일반 가입과 똑같이 막는다")
    void stillRejectsDuplicateEmail() {
        processor.devSignup(command("tester@example.com"));

        assertThatThrownBy(() -> processor.devSignup(command("tester@example.com")))
            .isInstanceOf(MemberException.class)
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.EXIST_MEMBER_EMAIL);
    }

    @Test
    @DisplayName("이메일을 정규화해 저장한다 — 대소문자만 바꾼 중복도 막힌다")
    void normalisesEmailBeforeSaving() {
        Member member = processor.devSignup(command("  TESTER@Example.COM  "));

        assertThat(member.email()).isEqualTo("tester@example.com");
        // 정규화를 빼먹으면 대문자 이메일로 같은 계정을 두 번 만들 수 있게 된다.
        assertThatThrownBy(() -> processor.devSignup(command("tester@example.com")))
            .isInstanceOf(MemberException.class);
    }

    @Test
    @DisplayName("비밀번호를 평문으로 저장하지 않는다")
    void encodesPassword() {
        Member member = processor.devSignup(command("tester@example.com"));

        assertThat(member.password()).isNotEqualTo(PASSWORD);
        assertThat(passwordEncoder.matches(PASSWORD, member.password())).isTrue();
    }

    @Test
    @DisplayName("권한과 상태는 일반 가입과 같다 — 개발 계정이 특별한 권한을 갖지 않는다")
    void createsOrdinaryMember() {
        Member member = processor.devSignup(command("tester@example.com"));

        assertThat(member.role()).isEqualTo(SecurityRole.USER);
        assertThat(member.status()).isEqualTo(MemberStatus.ACTIVE);
    }

    @Test
    @DisplayName("동의·확인 이력도 일반 가입과 똑같이 남긴다")
    void recordsConsentHistoryLikeGeneralSignup() {
        // 개발 계정만 이력이 비어 있으면, 이력을 읽는 쪽이 "없을 수도 있는 값"을 다루게 되고
        // 그 분기는 운영에서 검증되지 않는다. 이력의 내용은 MemberConsentProcessorTest 가 본다.
        Member member = processor.devSignup(command("tester@example.com"));

        assertThat(consentRepositoryPort.saved).hasSize(3);
        assertThat(consentRepositoryPort.saved).allSatisfy(
            consent -> assertThat(consent.memberId()).isEqualTo(member.id()));
    }

    @Test
    @DisplayName("동의 없는 요청은 개발 가입에서도 막힌다")
    void stillRejectsWithoutConsent() {
        // 인증만 건너뛰고 나머지는 같은 코드를 탄다는 원칙이 동의에도 적용된다.
        assertThatThrownBy(() -> processor.devSignup(commandWithoutConsent("tester@example.com")))
            .isInstanceOf(MemberException.class)
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.CONSENT_REQUIRED);

        assertThat(memberRepositoryPort.findByEmail("tester@example.com")).isEmpty();
        assertThat(consentRepositoryPort.saved).isEmpty();
    }

    @Test
    @DisplayName("만 14세 이상 확인이 없는 요청은 개발 가입에서도 막힌다")
    void stillRejectsWithoutAgeConfirmation() {
        // 연령 게이트를 개발 경로에만 열어 두면, 운영에서 막히는 입력으로 만든 계정이 개발 DB 에 쌓인다.
        assertThatThrownBy(() -> processor.devSignup(commandWithoutAgeConfirmation("tester@example.com")))
            .isInstanceOf(MemberException.class)
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.AGE_REQUIREMENT_NOT_MET);

        assertThat(memberRepositoryPort.findByEmail("tester@example.com")).isEmpty();
        assertThat(consentRepositoryPort.saved).isEmpty();
    }

    // --- fixtures ---

    private MemberGeneralSignupCommand command(String email) {
        return MemberGeneralSignupCommand.builder()
            .email(email).password(PASSWORD).name("테스터").nickname("테스터")
            .termsAgreed(true).privacyAgreed(true).ageOver14Confirmed(true)
            .build();
    }

    private MemberGeneralSignupCommand commandWithoutAgeConfirmation(String email) {
        return MemberGeneralSignupCommand.builder()
            .email(email).password(PASSWORD).name("테스터").nickname("테스터")
            .termsAgreed(true).privacyAgreed(true).ageOver14Confirmed(false)
            .build();
    }

    private MemberGeneralSignupCommand commandWithoutConsent(String email) {
        return MemberGeneralSignupCommand.builder()
            .email(email).password(PASSWORD).name("테스터").nickname("테스터")
            .termsAgreed(false).privacyAgreed(false).ageOver14Confirmed(true)
            .build();
    }

    private static class RecordingConsentRepositoryPort implements MemberConsentRepositoryPort {

        private final List<MemberConsent> saved = new ArrayList<>();

        @Override
        public void saveAll(List<MemberConsent> consents) {
            saved.addAll(consents);
        }

        @Override
        public void deleteAllByMemberIdIn(List<Long> memberIds) {
            saved.removeIf(consent -> memberIds.contains(consent.memberId()));
        }
    }

    private static class RecordingEmailVerificationPort implements SignupEmailVerificationPort {

        private int verifiedChecks;
        private final List<String> consumed = new ArrayList<>();

        @Override
        public boolean isVerified(String email) {
            verifiedChecks++;
            return false;
        }

        @Override
        public void consume(String email) {
            consumed.add(email);
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
        public boolean existsByEmailIn(List<String> emails) {
            return emails.stream().anyMatch(email -> findByEmail(email).isPresent());
        }

        @Override
        public Optional<Member> findById(long memberId) {
            return Optional.ofNullable(members.get(memberId));
        }

        @Override
        public List<String> findAllProfileImageKeys() {
            return List.of();
        }

        @Override
        public List<Long> findWithdrawnMemberIdsBefore(LocalDateTime threshold, int limit) {
            return List.of();
        }

        @Override
        public void deleteAllByIdIn(List<Long> memberIds) {
            memberIds.forEach(members::remove);
        }
    }
}

package com.hondigagae.domainlayer.auth.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.port.out.EmailVerificationStorePort;
import com.hondigagae.domainlayer.auth.application.port.out.JwtTokenStorePort;
import com.hondigagae.domainlayer.auth.application.port.out.MailSendPort;
import com.hondigagae.domainlayer.auth.application.port.out.PasswordResetStorePort;
import com.hondigagae.domainlayer.auth.application.service.support.VerificationCodeGenerator;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.global.properties.EmailSendLimitProperties;
import com.hondigagae.security.common.enums.SecurityRole;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class PasswordResetProcessorTest {

    private static final String EMAIL = "member@example.com";
    private static final String SOCIAL_EMAIL = "social@example.com";
    private static final String CLIENT_IP = "203.0.113.10";
    private static final int IP_MAX_SEND_COUNT = 10;

    private PasswordEncoder passwordEncoder;
    private StubPasswordResetStorePort resetStorePort;
    private StubEmailVerificationStorePort emailStorePort;
    private StubMailSendPort mailSendPort;
    private StubMemberRepositoryPort memberRepositoryPort;
    private StubJwtTokenStorePort jwtTokenStorePort;
    private PasswordResetProcessor processor;

    @BeforeEach
    void setUp() {
        // bcrypt strength 4 — 실제 인코딩 로직을 그대로 쓰면서 테스트 시간만 줄인다.
        passwordEncoder = new BCryptPasswordEncoder(4);
        resetStorePort = new StubPasswordResetStorePort();
        emailStorePort = new StubEmailVerificationStorePort();
        mailSendPort = new StubMailSendPort();
        memberRepositoryPort = new StubMemberRepositoryPort();
        jwtTokenStorePort = new StubJwtTokenStorePort();
        processor = new PasswordResetProcessor(
            resetStorePort,
            emailStorePort,
            mailSendPort,
            memberRepositoryPort,
            jwtTokenStorePort,
            passwordEncoder,
            new VerificationCodeGenerator(),
            new EmailSendLimitProperties(IP_MAX_SEND_COUNT, Duration.ofHours(1))
        );

        memberRepositoryPort.register(Member.builder()
            .id(1L).email(EMAIL).password(passwordEncoder.encode("OldPassword1!"))
            .nickname("tester").role(SecurityRole.USER).status(MemberStatus.ACTIVE)
            .build());
        memberRepositoryPort.register(Member.builder()
            .id(2L).email(SOCIAL_EMAIL).password(null).provider(OAuthProvider.KAKAO)
            .nickname("social").role(SecurityRole.USER).status(MemberStatus.ACTIVE)
            .build());
    }

    @Test
    void sendResetCode_generalAccount_sendsResetCode() {
        processor.sendResetCode(EMAIL, CLIENT_IP);

        assertThat(resetStorePort.findCode(EMAIL)).isPresent();
        assertThat(mailSendPort.resetCodeMails).containsExactly(EMAIL);
    }

    @Test
    void sendResetCode_unregisteredEmail_sendsNotRegisteredNoticeWithSameResponse() {
        // 응답(예외 없음)은 동일하고 메일 내용만 다르다 — 계정 존재 여부 비노출
        processor.sendResetCode("unknown@example.com", CLIENT_IP);

        assertThat(resetStorePort.findCode("unknown@example.com")).isEmpty();
        assertThat(mailSendPort.notRegisteredMails).containsExactly("unknown@example.com");
    }

    @Test
    void sendResetCode_socialOnlyAccount_sendsSocialOnlyNotice() {
        processor.sendResetCode(SOCIAL_EMAIL, CLIENT_IP);

        assertThat(resetStorePort.findCode(SOCIAL_EMAIL)).isEmpty();
        assertThat(mailSendPort.socialOnlyMails).containsExactly(SOCIAL_EMAIL);
    }

    @Test
    void sendResetCode_overIpLimit_rejects() {
        emailStorePort.ipCounts.put(CLIENT_IP, (long) IP_MAX_SEND_COUNT);

        assertThatThrownBy(() -> processor.sendResetCode(EMAIL, CLIENT_IP))
            .isInstanceOf(AuthException.class)
            .extracting(exception -> ((AuthException) exception).getErrorCode())
            .isEqualTo(AuthErrorCode.EMAIL_SEND_IP_LIMITED);
    }

    @Test
    void sendResetCode_withinCooldown_rejects() {
        processor.sendResetCode(EMAIL, CLIENT_IP);

        assertThatThrownBy(() -> processor.sendResetCode(EMAIL, CLIENT_IP))
            .isInstanceOf(AuthException.class)
            .extracting(exception -> ((AuthException) exception).getErrorCode())
            .isEqualTo(AuthErrorCode.EMAIL_CODE_COOLDOWN);
    }

    @Test
    void resetPassword_changesPasswordAndRevokesAllSessions() {
        processor.sendResetCode(EMAIL, CLIENT_IP);
        String code = resetStorePort.findCode(EMAIL).orElseThrow();

        processor.resetPassword(EMAIL, code, "NewPassword2@");

        Member updated = memberRepositoryPort.findByEmail(EMAIL).orElseThrow();
        assertThat(passwordEncoder.matches("NewPassword2@", updated.password())).isTrue();
        assertThat(jwtTokenStorePort.allSessionsDeletedMemberIds).containsExactly(1L);
        // 코드는 소비되어 재사용할 수 없다
        assertThat(resetStorePort.findCode(EMAIL)).isEmpty();
    }

    @Test
    void resetPassword_withoutIssuedCode_rejectsAsExpired() {
        assertThatThrownBy(() -> processor.resetPassword(EMAIL, "ANYCODE1", "NewPassword2@"))
            .isInstanceOf(AuthException.class)
            .extracting(exception -> ((AuthException) exception).getErrorCode())
            .isEqualTo(AuthErrorCode.EXPIRED_EMAIL_CODE);
    }

    @Test
    void resetPassword_wrongCodeFiveTimes_invalidatesCode() {
        processor.sendResetCode(EMAIL, CLIENT_IP);

        // 4회까지는 코드 불일치, 5회째에 코드 무효화
        for (int attempt = 0; attempt < 4; attempt++) {
            assertThatThrownBy(() -> processor.resetPassword(EMAIL, "WRONGCOD", "NewPassword2@"))
                .isInstanceOf(AuthException.class)
                .extracting(exception -> ((AuthException) exception).getErrorCode())
                .isEqualTo(AuthErrorCode.INVALID_EMAIL_CODE);
        }
        assertThatThrownBy(() -> processor.resetPassword(EMAIL, "WRONGCOD", "NewPassword2@"))
            .isInstanceOf(AuthException.class)
            .extracting(exception -> ((AuthException) exception).getErrorCode())
            .isEqualTo(AuthErrorCode.PASSWORD_RESET_ATTEMPTS_EXCEEDED);

        // 무효화 이후에는 올바른 코드였더라도 만료 응답이 된다
        assertThat(resetStorePort.findCode(EMAIL)).isEmpty();
    }

    private static class StubPasswordResetStorePort implements PasswordResetStorePort {

        private final Map<String, String> codes = new HashMap<>();
        private final Set<String> cooldowns = new HashSet<>();
        private final Map<String, Long> failures = new HashMap<>();

        @Override
        public void saveCode(String email, String code, Duration ttl) {
            codes.put(email, code);
        }

        @Override
        public Optional<String> findCode(String email) {
            return Optional.ofNullable(codes.get(email));
        }

        @Override
        public void deleteCode(String email) {
            codes.remove(email);
        }

        @Override
        public boolean tryAcquireCooldown(String email, Duration ttl) {
            return cooldowns.add(email);
        }

        @Override
        public long increaseVerifyFailureCount(String email, Duration ttl) {
            return failures.merge(email, 1L, Long::sum);
        }

        @Override
        public void clearVerifyFailures(String email) {
            failures.remove(email);
        }
    }

    private static class StubEmailVerificationStorePort implements EmailVerificationStorePort {

        private final Map<String, Long> ipCounts = new HashMap<>();

        @Override
        public void saveCode(String email, String code, Duration ttl) {
        }

        @Override
        public Optional<String> findCode(String email) {
            return Optional.empty();
        }

        @Override
        public void deleteCode(String email) {
        }

        @Override
        public void saveVerified(String email, Duration ttl) {
        }

        @Override
        public boolean isVerified(String email) {
            return false;
        }

        @Override
        public void deleteVerified(String email) {
        }

        @Override
        public boolean tryAcquireCooldown(String email, Duration ttl) {
            return true;
        }

        @Override
        public long increaseIpSendCount(String clientIp, Duration window) {
            return ipCounts.merge(clientIp, 1L, Long::sum);
        }
    }

    private static class StubMailSendPort implements MailSendPort {

        private final List<String> resetCodeMails = new ArrayList<>();
        private final List<String> notRegisteredMails = new ArrayList<>();
        private final List<String> socialOnlyMails = new ArrayList<>();

        @Override
        public void sendVerificationCode(String email, String code) {
        }

        @Override
        public void sendAlreadyRegisteredNotice(String email) {
        }

        @Override
        public void sendPasswordResetCode(String email, String code) {
            resetCodeMails.add(email);
        }

        @Override
        public void sendPasswordResetNotRegisteredNotice(String email) {
            notRegisteredMails.add(email);
        }

        @Override
        public void sendPasswordResetSocialOnlyNotice(String email, String providerName) {
            socialOnlyMails.add(email);
        }

    }

    private static class StubMemberRepositoryPort implements MemberRepositoryPort {

        private final Map<String, Member> members = new HashMap<>();

        void register(Member member) {
            members.put(member.email(), member);
        }

        @Override
        public Member save(Member domain) {
            members.put(domain.email(), domain);
            return domain;
        }

        @Override
        public boolean existsByEmail(String email) {
            return members.containsKey(email);
        }

        @Override
        public Optional<Member> findByEmail(String email) {
            return Optional.ofNullable(members.get(email));
        }

        @Override
        public Optional<Member> findById(long memberId) {
            return members.values().stream().filter(member -> member.id() == memberId).findFirst();
        }
    }

    private static class StubJwtTokenStorePort implements JwtTokenStorePort {

        private final List<Long> allSessionsDeletedMemberIds = new ArrayList<>();

        @Override
        public void save(long memberId, String sessionId, String refreshToken) {
        }

        @Override
        public Optional<String> find(long memberId, String sessionId) {
            return Optional.empty();
        }

        @Override
        public void deleteSession(long memberId, String sessionId) {
        }

        @Override
        public void deleteAllSessions(long memberId) {
            allSessionsDeletedMemberIds.add(memberId);
        }

        @Override
        public void saveAccessTokenIdBlacklist(String tokenId, Duration ttl) {
        }
    }
}

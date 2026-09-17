package com.hondigagae.domainlayer.auth.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.port.out.EmailVerificationStorePort;
import com.hondigagae.domainlayer.auth.application.port.out.MailSendPort;
import com.hondigagae.domainlayer.auth.application.service.support.VerificationCodeGenerator;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.application.service.support.WithdrawnEmailHasher;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.global.properties.EmailSendLimitProperties;
import com.hondigagae.global.properties.WithdrawnEmailProperties;
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

class EmailVerificationProcessorTest {

    private static final String CLIENT_IP = "203.0.113.10";
    private static final int IP_MAX_SEND_COUNT = 3;
    private static final String WITHDRAWN_EMAIL = "withdrawn@example.com";

    private StubEmailVerificationStorePort storePort;
    private StubMailSendPort mailSendPort;
    private StubMemberRepositoryPort memberRepositoryPort;
    private WithdrawnEmailHasher withdrawnEmailHasher;
    private EmailVerificationProcessor processor;

    @BeforeEach
    void setUp() {
        storePort = new StubEmailVerificationStorePort();
        mailSendPort = new StubMailSendPort();
        memberRepositoryPort = new StubMemberRepositoryPort();
        withdrawnEmailHasher = new WithdrawnEmailHasher(
            new WithdrawnEmailProperties("email-verification-test-pepper-0123456789"));
        processor = new EmailVerificationProcessor(
            storePort,
            mailSendPort,
            memberRepositoryPort,
            withdrawnEmailHasher,
            new EmailSendLimitProperties(IP_MAX_SEND_COUNT, Duration.ofHours(1)),
            new VerificationCodeGenerator()
        );
    }

    @Test
    void sendCode_underIpLimit_sendsVerificationCode() {
        processor.sendCode("user1@example.com", CLIENT_IP);

        assertThat(mailSendPort.sentCodes).hasSize(1);
    }

    /**
     * 탈퇴 회원의 email 은 다이제스트로 치환돼 있어 원문 조회에 잡히지 않는다. 원문만 보면 탈퇴한
     * 주소로 인증코드가 발급되고 verified 플래그까지 잡힌 뒤 마지막 가입에서야 막힌다 —
     * "기가입 이메일에는 코드를 주지 않는다"가 탈퇴자에게만 깨진다.
     */
    @Test
    void sendCode_withdrawnEmail_sendsAlreadyRegisteredNoticeInsteadOfCode() {
        memberRepositoryPort.register(withdrawnEmailHasher.hash(WITHDRAWN_EMAIL));

        processor.sendCode(WITHDRAWN_EMAIL, CLIENT_IP);

        assertThat(mailSendPort.sentCodes).isEmpty();
        assertThat(mailSendPort.alreadyRegisteredNotices).containsExactly(WITHDRAWN_EMAIL);
        // 코드가 저장되지 않아야 한다 — 저장되면 verifyCode 로 verified 플래그까지 잡을 수 있다.
        assertThat(storePort.findCode(WITHDRAWN_EMAIL)).isEmpty();
    }

    @Test
    void sendCode_activeEmail_sendsAlreadyRegisteredNoticeInsteadOfCode() {
        // 원문으로 남아 있는 기가입(ACTIVE) 계정도 같은 경로를 탄다 — 두 경우의 응답이 같아야
        // 발송 결과로 탈퇴/가입 상태를 구분할 수 없다.
        memberRepositoryPort.register("active@example.com");

        processor.sendCode("active@example.com", CLIENT_IP);

        assertThat(mailSendPort.sentCodes).isEmpty();
        assertThat(mailSendPort.alreadyRegisteredNotices).containsExactly("active@example.com");
    }

    @Test
    void sendCode_overIpLimit_rejectsEvenForDifferentEmails() {
        // 이메일 쿨다운을 우회하려고 이메일을 바꿔가며 발송해도 IP 상한에 걸린다
        for (int i = 0; i < IP_MAX_SEND_COUNT; i++) {
            processor.sendCode("user" + i + "@example.com", CLIENT_IP);
        }

        assertThatThrownBy(() -> processor.sendCode("another@example.com", CLIENT_IP))
            .isInstanceOf(AuthException.class)
            .extracting(exception -> ((AuthException) exception).getErrorCode())
            .isEqualTo(AuthErrorCode.EMAIL_SEND_IP_LIMITED);
        assertThat(mailSendPort.sentCodes).hasSize(IP_MAX_SEND_COUNT);
    }

    @Test
    void sendCode_ipLimitIsPerIp() {
        for (int i = 0; i < IP_MAX_SEND_COUNT; i++) {
            processor.sendCode("user" + i + "@example.com", CLIENT_IP);
        }

        // 다른 IP 는 자기 상한을 따로 센다
        processor.sendCode("other-ip@example.com", "198.51.100.7");

        assertThat(mailSendPort.sentCodes).hasSize(IP_MAX_SEND_COUNT + 1);
    }

    @Test
    void sendCode_storeFailure_failsOpen() {
        // 저장소 장애(카운터 0 반환) 시 상한이 발송 자체를 막지 않는다
        storePort.ipCounterBroken = true;

        processor.sendCode("user@example.com", CLIENT_IP);

        assertThat(mailSendPort.sentCodes).hasSize(1);
    }

    @Test
    void sendCode_withinEmailCooldown_rejects() {
        processor.sendCode("user@example.com", CLIENT_IP);

        assertThatThrownBy(() -> processor.sendCode("user@example.com", CLIENT_IP))
            .isInstanceOf(AuthException.class)
            .extracting(exception -> ((AuthException) exception).getErrorCode())
            .isEqualTo(AuthErrorCode.EMAIL_CODE_COOLDOWN);
    }

    @Test
    void verifyCode_fifthMismatch_invalidatesCode() {
        storePort.saveCode("user@example.com", "12345678", Duration.ofMinutes(5));

        // 4번째까지는 오입력 응답, 5번째에 코드가 무효화된다 — 재설정과 같은 상한
        for (int attempt = 0; attempt < 4; attempt++) {
            assertThatThrownBy(() -> processor.verifyCode("user@example.com", "wrong"))
                .isInstanceOf(AuthException.class)
                .extracting(exception -> ((AuthException) exception).getErrorCode())
                .isEqualTo(AuthErrorCode.INVALID_EMAIL_CODE);
        }
        assertThatThrownBy(() -> processor.verifyCode("user@example.com", "wrong"))
            .isInstanceOf(AuthException.class)
            .extracting(exception -> ((AuthException) exception).getErrorCode())
            .isEqualTo(AuthErrorCode.EMAIL_CODE_ATTEMPTS_EXCEEDED);

        // 코드가 무효화됐으므로 정답을 넣어도 만료로 응답한다
        assertThatThrownBy(() -> processor.verifyCode("user@example.com", "12345678"))
            .isInstanceOf(AuthException.class)
            .extracting(exception -> ((AuthException) exception).getErrorCode())
            .isEqualTo(AuthErrorCode.EXPIRED_EMAIL_CODE);
    }

    @Test
    void verifyCode_successAfterFailures_clearsCounter() {
        storePort.saveCode("user@example.com", "12345678", Duration.ofMinutes(5));
        assertThatThrownBy(() -> processor.verifyCode("user@example.com", "wrong"))
            .isInstanceOf(AuthException.class);

        // 상한 전에 성공하면 카운터가 초기화된다
        processor.verifyCode("user@example.com", "12345678");
        storePort.saveCode("user@example.com", "87654321", Duration.ofMinutes(5));
        for (int attempt = 0; attempt < 4; attempt++) {
            assertThatThrownBy(() -> processor.verifyCode("user@example.com", "wrong"))
                .isInstanceOf(AuthException.class)
                .extracting(exception -> ((AuthException) exception).getErrorCode())
                .isEqualTo(AuthErrorCode.INVALID_EMAIL_CODE);
        }
    }

    private static class StubEmailVerificationStorePort implements EmailVerificationStorePort {

        private final Map<String, String> codes = new HashMap<>();
        private final Set<String> cooldowns = new HashSet<>();
        private final Map<String, Long> ipCounts = new HashMap<>();
        private boolean ipCounterBroken;

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
            return cooldowns.add(email);
        }

        @Override
        public long increaseIpSendCount(String clientIp, Duration window) {
            if (ipCounterBroken) {
                return 0L;
            }
            return ipCounts.merge(clientIp, 1L, Long::sum);
        }

        @Override
        public long increaseVerifyFailureCount(String email, Duration ttl) {
            return failCounts.merge(email, 1L, Long::sum);
        }

        @Override
        public void clearVerifyFailures(String email) {
            failCounts.remove(email);
        }

        private final Map<String, Long> failCounts = new HashMap<>();
    }

    private static class StubMailSendPort implements MailSendPort {

        private final List<String> sentCodes = new ArrayList<>();
        private final List<String> alreadyRegisteredNotices = new ArrayList<>();

        @Override
        public void sendVerificationCode(String email, String code) {
            sentCodes.add(email);
        }

        @Override
        public void sendAlreadyRegisteredNotice(String email) {
            alreadyRegisteredNotices.add(email);
        }

        @Override
        public void sendPasswordResetCode(String email, String code) {
        }

        @Override
        public void sendPasswordResetNotRegisteredNotice(String email) {
        }

        @Override
        public void sendPasswordResetSocialOnlyNotice(String email, String providerName) {
        }

        @Override
        public void sendSocialLinkedNotice(String email, String providerName) {
        }

        @Override
        public void sendPasswordRemovedNotice(String email, String providerName) {
        }
    }

    /** email 컬럼에 실제로 들어 있는 값만 들고 있는다 — 탈퇴 행이면 그 값이 다이제스트다. */
    private static class StubMemberRepositoryPort implements MemberRepositoryPort {

        private final Set<String> storedEmails = new HashSet<>();

        void register(String storedEmail) {
            storedEmails.add(storedEmail);
        }

        @Override
        public Member save(Member domain) {
            return domain;
        }

        @Override
        public Optional<Member> findByEmail(String email) {
            return Optional.empty();
        }

        @Override
        public boolean existsByEmailIn(java.util.List<String> emails) {
            return emails.stream().anyMatch(storedEmails::contains);
        }

        @Override
        public Optional<Member> findById(long memberId) {
            return Optional.empty();
        }

        @Override
        public java.util.List<String> findAllProfileImageKeys() {
            return java.util.List.of();
        }

        @Override
        public java.util.List<Long> findWithdrawnMemberIdsBefore(java.time.LocalDateTime threshold, int limit) {
            return java.util.List.of();
        }

        @Override
        public void deleteAllByIdIn(java.util.List<Long> memberIds) {
        }
    }
}

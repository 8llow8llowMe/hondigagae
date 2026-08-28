package com.hondigagae.domainlayer.auth.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.port.out.EmailVerificationStorePort;
import com.hondigagae.domainlayer.auth.application.port.out.MailSendPort;
import com.hondigagae.domainlayer.auth.application.service.support.VerificationCodeGenerator;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.global.properties.EmailSendLimitProperties;
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

    private StubEmailVerificationStorePort storePort;
    private StubMailSendPort mailSendPort;
    private EmailVerificationProcessor processor;

    @BeforeEach
    void setUp() {
        storePort = new StubEmailVerificationStorePort();
        mailSendPort = new StubMailSendPort();
        processor = new EmailVerificationProcessor(
            storePort,
            mailSendPort,
            new StubMemberRepositoryPort(),
            new EmailSendLimitProperties(IP_MAX_SEND_COUNT, Duration.ofHours(1)),
            new VerificationCodeGenerator()
        );
    }

    @Test
    void sendCode_underIpLimit_sendsVerificationCode() {
        processor.sendCode("user1@example.com", CLIENT_IP);

        assertThat(mailSendPort.sentCodes).hasSize(1);
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
    }

    private static class StubMailSendPort implements MailSendPort {

        private final List<String> sentCodes = new ArrayList<>();

        @Override
        public void sendVerificationCode(String email, String code) {
            sentCodes.add(email);
        }

        @Override
        public void sendAlreadyRegisteredNotice(String email) {
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
    }

    private static class StubMemberRepositoryPort implements MemberRepositoryPort {

        @Override
        public Member save(Member domain) {
            return domain;
        }

        @Override
        public boolean existsByEmail(String email) {
            return false;
        }

        @Override
        public Optional<Member> findByEmail(String email) {
            return Optional.empty();
        }

        @Override
        public Optional<Member> findById(long memberId) {
            return Optional.empty();
        }
    }
}

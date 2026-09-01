package com.hondigagae.domainlayer.auth.application.service.processor;

import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.port.out.EmailVerificationStorePort;
import com.hondigagae.domainlayer.auth.application.port.out.MailSendPort;
import com.hondigagae.domainlayer.auth.application.service.support.VerificationCodeGenerator;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.global.properties.EmailSendLimitProperties;
import java.time.Duration;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailVerificationProcessor {

    private static final Duration CODE_TTL = Duration.ofMinutes(5);
    private static final Duration VERIFIED_TTL = Duration.ofMinutes(30);
    private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    /** 코드 오입력 허용 횟수. 재설정(PasswordResetProcessor)과 같은 상한 — 같은 브루트포스 표면이다. */
    private static final int MAX_VERIFY_FAILURES = 5;

    private final EmailVerificationStorePort emailVerificationStorePort;
    private final MailSendPort mailSendPort;
    private final MemberRepositoryPort memberRepositoryPort;
    private final EmailSendLimitProperties emailSendLimitProperties;
    private final VerificationCodeGenerator verificationCodeGenerator;

    /**
     * 가입 여부와 무관하게 항상 동일하게 성공 응답한다(계정 열거 방지).
     * 기가입 이메일에는 인증코드 대신 "이미 가입된 계정" 안내 메일을 발송해
     * 메일박스 소유자만 상태를 알 수 있게 한다.
     */
    public void sendCode(String rawEmail, String clientIp) {
        String email = normalize(rawEmail);

        // 1. IP 발송 상한 — 이메일 쿨다운은 키가 이메일이라, 한 IP 가 서로 다른 이메일 다수로
        //    발송을 반복하는 남용을 막지 못한다. IP 차원의 고정 윈도우 상한을 먼저 검사한다.
        long ipSendCount = emailVerificationStorePort.increaseIpSendCount(clientIp, emailSendLimitProperties.ipWindow());
        if (ipSendCount > emailSendLimitProperties.ipMaxSendCount()) {
            throw new AuthException(AuthErrorCode.EMAIL_SEND_IP_LIMITED);
        }

        // 2. 재발송 쿨다운 (가입 여부 판별보다 먼저 적용해 프로빙에도 동일 비용을 부과한다)
        if (!emailVerificationStorePort.tryAcquireCooldown(email, RESEND_COOLDOWN)) {
            throw new AuthException(AuthErrorCode.EMAIL_CODE_COOLDOWN);
        }

        // 3. 기가입 이메일이면 안내 메일만 발송하고 동일하게 성공 처리
        if (memberRepositoryPort.findByEmail(email).isPresent()) {
            mailSendPort.sendAlreadyRegisteredNotice(email);
            return;
        }

        // 4. 인증코드 생성/저장 후 비동기 발송 (새 코드 발급 시 이전 실패 카운터도 함께 초기화)
        String code = verificationCodeGenerator.generate();
        emailVerificationStorePort.saveCode(email, code, CODE_TTL);
        emailVerificationStorePort.clearVerifyFailures(email);
        mailSendPort.sendVerificationCode(email, code);
    }

    public void verifyCode(String rawEmail, String code) {
        String email = normalize(rawEmail);

        String storedCode = emailVerificationStorePort.findCode(email)
            .orElseThrow(() -> new AuthException(AuthErrorCode.EXPIRED_EMAIL_CODE));

        if (!storedCode.equals(code)) {
            // 실패가 누적되면 코드를 무효화해 브루트포스를 차단한다 (8자 코드·TTL 5분이라도 상한 없인 표면이 열려 있다)
            long failures = emailVerificationStorePort.increaseVerifyFailureCount(email, CODE_TTL);
            if (failures >= MAX_VERIFY_FAILURES) {
                emailVerificationStorePort.deleteCode(email);
                throw new AuthException(AuthErrorCode.EMAIL_CODE_ATTEMPTS_EXCEEDED);
            }
            throw new AuthException(AuthErrorCode.INVALID_EMAIL_CODE);
        }

        // 인증완료 플래그를 먼저 저장하고 코드를 지운다 — 중간 장애 시 "코드만 소비된" 상태를 피한다.
        emailVerificationStorePort.saveVerified(email, VERIFIED_TTL);
        emailVerificationStorePort.deleteCode(email);
        emailVerificationStorePort.clearVerifyFailures(email);
    }

    /**
     * Redis 키(case-sensitive)와 DB 조회(collation 기반) 간 대소문자 정합성을 위해
     * 이메일은 항상 trim + 소문자로 정규화해 사용한다.
     */
    public static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}

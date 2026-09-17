package com.hondigagae.domainlayer.auth.application.service.processor;

import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.port.out.EmailVerificationStorePort;
import com.hondigagae.domainlayer.auth.application.port.out.JwtTokenStorePort;
import com.hondigagae.domainlayer.auth.application.port.out.MailSendPort;
import com.hondigagae.domainlayer.auth.application.port.out.PasswordResetStorePort;
import com.hondigagae.domainlayer.auth.application.service.support.VerificationCodeGenerator;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.application.service.support.EmailNormalizer;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.global.properties.EmailSendLimitProperties;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 비밀번호 재설정 (일반 로그인 계정 전용, 미인증 흐름).
 *
 * <p><b>계정 존재 여부 비노출</b>: 발송 요청의 응답은 어떤 경우에도 동일하게 성공이며,
 * 분기(코드 발송 / 미가입 안내 / 소셜 전용 안내)는 전부 메일 내용으로만 전달한다 —
 * 응답으로 구분하면 그 자체가 계정 열거 벡터가 된다.
 */
@Service
@RequiredArgsConstructor
public class PasswordResetProcessor {

    private static final Duration CODE_TTL = Duration.ofMinutes(5);
    private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    private static final int MAX_VERIFY_FAILURES = 5;

    private final PasswordResetStorePort passwordResetStorePort;
    // IP 발송 상한 카운터는 회원가입 인증 발송과 공유한다 — "이 IP 가 메일을 몇 번 보냈나"는 API 구분 없이 센다.
    private final EmailVerificationStorePort emailVerificationStorePort;
    private final MailSendPort mailSendPort;
    private final MemberRepositoryPort memberRepositoryPort;
    private final JwtTokenStorePort jwtTokenStorePort;
    private final PasswordEncoder passwordEncoder;
    private final VerificationCodeGenerator verificationCodeGenerator;
    private final EmailSendLimitProperties emailSendLimitProperties;

    public void sendResetCode(String rawEmail, String clientIp) {
        String email = EmailNormalizer.normalize(rawEmail);

        // 1. IP 발송 상한 → 이메일 쿨다운 (회원가입 발송과 동일한 순서/방어)
        long ipSendCount = emailVerificationStorePort.increaseIpSendCount(clientIp, emailSendLimitProperties.ipWindow());
        if (ipSendCount > emailSendLimitProperties.ipMaxSendCount()) {
            throw new AuthException(AuthErrorCode.EMAIL_SEND_IP_LIMITED);
        }
        if (!passwordResetStorePort.tryAcquireCooldown(email, RESEND_COOLDOWN)) {
            throw new AuthException(AuthErrorCode.EMAIL_CODE_COOLDOWN);
        }

        // 2. 계정 상태별 분기 — 응답은 전부 동일하고 메일 내용만 다르다
        Optional<Member> memberHolder = memberRepositoryPort.findByEmail(email);
        if (memberHolder.isEmpty() || memberHolder.get().status() != MemberStatus.ACTIVE) {
            mailSendPort.sendPasswordResetNotRegisteredNotice(email);
            return;
        }
        Member member = memberHolder.get();
        if (member.password() == null) {
            // 소셜 전용 계정 — 비밀번호가 없으므로 소셜 로그인 이용을 안내한다
            mailSendPort.sendPasswordResetSocialOnlyNotice(email, member.provider().getDescription());
            return;
        }

        // 3. 재설정 코드 발급 (새 코드 발급 시 이전 실패 카운터도 함께 초기화)
        String code = verificationCodeGenerator.generate();
        passwordResetStorePort.saveCode(email, code, CODE_TTL);
        passwordResetStorePort.clearVerifyFailures(email);
        mailSendPort.sendPasswordResetCode(email, code);
    }

    @Transactional
    public void resetPassword(String rawEmail, String code, String newPassword) {
        String email = EmailNormalizer.normalize(rawEmail);

        // 1. 코드 검증 — 실패가 누적되면 코드를 무효화해 브루트포스를 차단한다
        String storedCode = passwordResetStorePort.findCode(email)
            .orElseThrow(() -> new AuthException(AuthErrorCode.EXPIRED_EMAIL_CODE));
        if (!storedCode.equals(code)) {
            long failures = passwordResetStorePort.increaseVerifyFailureCount(email, CODE_TTL);
            if (failures >= MAX_VERIFY_FAILURES) {
                passwordResetStorePort.deleteCode(email);
                throw new AuthException(AuthErrorCode.PASSWORD_RESET_ATTEMPTS_EXCEEDED);
            }
            throw new AuthException(AuthErrorCode.INVALID_EMAIL_CODE);
        }

        // 2. 계정 재검증 — 발송과 재설정 사이에 탈퇴/정지된 경우는 코드 만료와 동일하게 응답한다
        //    (이 시점에 상태를 상세히 알려줄 이유가 없다)
        Member member = memberRepositoryPort.findByEmail(email)
            .filter(found -> found.status() == MemberStatus.ACTIVE && found.password() != null)
            .orElseThrow(() -> new AuthException(AuthErrorCode.EXPIRED_EMAIL_CODE));

        // 3. 비밀번호 교체 + 전 기기 세션 무효화 — 탈취범이 유지 중인 세션을 남기지 않는다.
        //    세션 무효화 실패는 전파되어 비밀번호 변경과 함께 롤백된다.
        memberRepositoryPort.save(member.changePassword(passwordEncoder.encode(newPassword)));
        jwtTokenStorePort.deleteAllSessions(member.id());

        // 4. 코드 소비
        passwordResetStorePort.deleteCode(email);
        passwordResetStorePort.clearVerifyFailures(email);
    }
}

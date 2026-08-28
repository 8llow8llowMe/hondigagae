package com.hondigagae.domainlayer.auth.adapter.out.mail;

import com.hondigagae.domainlayer.auth.application.port.out.MailSendPort;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class JavaMailSenderAdapter implements MailSendPort {

    private static final String CODE_SUBJECT = "[혼디가개] 이메일 인증코드 안내";
    private static final String NOTICE_SUBJECT = "[혼디가개] 회원가입 안내";
    private static final String RESET_SUBJECT = "[혼디가개] 비밀번호 재설정 안내";
    private static final String SOCIAL_LINKED_SUBJECT = "[혼디가개] 소셜 로그인 연결 안내";

    private final JavaMailSender javaMailSender;

    /**
     * SMTP 왕복(수 초)이 요청 스레드를 점유하지 않도록 전용 executor에서 비동기 발송한다.
     * 발송 실패는 로그로만 남긴다 — 사용자는 코드 미수신 시 쿨다운 이후 재요청한다.
     */
    @Override
    @Async("authMailTaskExecutor")
    public void sendVerificationCode(String email, String code) {
        send(email, CODE_SUBJECT, buildCodeBody(code));
    }

    @Override
    @Async("authMailTaskExecutor")
    public void sendAlreadyRegisteredNotice(String email) {
        send(email, NOTICE_SUBJECT, buildNoticeBody());
    }

    @Override
    @Async("authMailTaskExecutor")
    public void sendPasswordResetCode(String email, String code) {
        send(email, RESET_SUBJECT, buildResetCodeBody(code));
    }

    @Override
    @Async("authMailTaskExecutor")
    public void sendPasswordResetNotRegisteredNotice(String email) {
        send(email, RESET_SUBJECT, buildResetNotRegisteredBody());
    }

    @Override
    @Async("authMailTaskExecutor")
    public void sendPasswordResetSocialOnlyNotice(String email, String providerName) {
        send(email, RESET_SUBJECT, buildResetSocialOnlyBody(providerName));
    }

    @Override
    @Async("authMailTaskExecutor")
    public void sendSocialLinkedNotice(String email, String providerName) {
        send(email, SOCIAL_LINKED_SUBJECT, buildSocialLinkedBody(providerName));
    }

    private void send(String email, String subject, String body) {
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setTo(email);
            helper.setSubject(subject);
            helper.setText(body, true);
            javaMailSender.send(message);
        } catch (Exception e) {
            log.error("[JavaMailSenderAdapter] 메일 발송 실패: email={}, subject={}, error={}", mask(email), subject, e.getMessage());
        }
    }

    // 로그에 이메일 원문(PII)이 남지 않도록 로컬파트를 마스킹한다.
    private String mask(String email) {
        int atIndex = email.indexOf('@');
        if (atIndex <= 1) {
            return "***" + (atIndex >= 0 ? email.substring(atIndex) : "");
        }
        return email.charAt(0) + "***" + email.substring(atIndex);
    }

    private String buildCodeBody(String code) {
        return """
            <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1a1a2e;">혼디가개 이메일 인증</h2>
              <p>아래 인증코드를 5분 이내에 입력해주세요.</p>
              <div style="background: #f4f4f8; border-radius: 8px; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px;">%s</div>
              <p style="color: #888; font-size: 12px; margin-top: 16px;">본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>
            </div>
            """.formatted(code);
    }

    private String buildNoticeBody() {
        return """
            <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1a1a2e;">혼디가개 회원가입 안내</h2>
              <p>이 이메일로는 이미 가입된 계정이 있습니다.</p>
              <p>비밀번호를 잊으셨다면 로그인 화면에서 비밀번호 찾기를 이용해주세요.</p>
              <p style="color: #888; font-size: 12px; margin-top: 16px;">본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>
            </div>
            """;
    }

    private String buildResetCodeBody(String code) {
        return """
            <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1a1a2e;">혼디가개 비밀번호 재설정</h2>
              <p>아래 인증코드를 5분 이내에 입력하고 새 비밀번호를 설정해주세요.</p>
              <div style="background: #f4f4f8; border-radius: 8px; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px;">%s</div>
              <p style="color: #888; font-size: 12px; margin-top: 16px;">본인이 요청하지 않았다면 이 메일을 무시해주세요. 비밀번호는 변경되지 않습니다.</p>
            </div>
            """.formatted(code);
    }

    private String buildResetNotRegisteredBody() {
        return """
            <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1a1a2e;">혼디가개 비밀번호 재설정 안내</h2>
              <p>이 이메일로 가입된 계정이 없습니다.</p>
              <p>이메일 주소를 다시 확인하시거나, 회원가입을 진행해주세요.</p>
              <p style="color: #888; font-size: 12px; margin-top: 16px;">본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>
            </div>
            """;
    }

    private String buildResetSocialOnlyBody(String providerName) {
        return """
            <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1a1a2e;">혼디가개 비밀번호 재설정 안내</h2>
              <p>이 계정은 <b>%s 로그인</b>으로 가입되어 별도의 비밀번호가 없습니다.</p>
              <p>로그인 화면에서 %s 로그인을 이용해주세요.</p>
              <p style="color: #888; font-size: 12px; margin-top: 16px;">본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>
            </div>
            """.formatted(providerName, providerName);
    }

    private String buildSocialLinkedBody(String providerName) {
        return """
            <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1a1a2e;">혼디가개 소셜 로그인 연결 안내</h2>
              <p>회원님의 계정에 <b>%s 로그인</b>이 연결되었습니다.</p>
              <p>이제 기존 이메일 로그인과 %s 로그인 모두 사용할 수 있습니다.</p>
              <p style="color: #d32f2f; font-size: 13px; margin-top: 16px;">본인이 한 것이 아니라면 즉시 비밀번호를 변경해주세요.</p>
            </div>
            """.formatted(providerName, providerName);
    }
}

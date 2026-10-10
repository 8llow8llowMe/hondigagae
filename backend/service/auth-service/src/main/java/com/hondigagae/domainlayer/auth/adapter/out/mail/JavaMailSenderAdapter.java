package com.hondigagae.domainlayer.auth.adapter.out.mail;

import com.hondigagae.domainlayer.auth.application.port.out.MailSendPort;
import com.hondigagae.global.properties.AuthMailProperties;
import jakarta.mail.internet.MimeMessage;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class JavaMailSenderAdapter implements MailSendPort {

    private static final String CODE_SUBJECT = "[혼디가개] 이메일 인증코드 안내";
    private static final String NOTICE_SUBJECT = "[혼디가개] 회원가입 안내";
    private static final String RESET_SUBJECT = "[혼디가개] 비밀번호 재설정 안내";
    private static final String SOCIAL_LINKED_SUBJECT = "[혼디가개] 소셜 로그인 연결 안내";
    private static final String PASSWORD_REMOVED_SUBJECT = "[혼디가개] 소셜 전용 계정 전환 안내";

    private static final String GMAIL_HOST_SUFFIX = "gmail.com";
    private static final String GMAIL_ADDRESS_SUFFIX = "@gmail.com";
    private static final String LOGO_CONTENT_TYPE = "image/png";

    private final JavaMailSender javaMailSender;
    private final MailTemplateRenderer mailTemplateRenderer;
    private final String fromName;
    private final String fromAddress;
    // 비어 있으면 인라인 로고를 붙이지 않는다 — 로고 URL 이 설정됐을 때(템플릿이 URL 을 가리킨다).
    // 키는 Content-ID, 값은 리소스다. 라이트·다크 두 장이다.
    private final Map<String, ClassPathResource> inlineLogos;

    public JavaMailSenderAdapter(JavaMailSender javaMailSender, MailTemplateRenderer mailTemplateRenderer, AuthMailProperties authMailProperties,
                                 @Value("${spring.mail.username:}") String mailUsername, @Value("${spring.mail.host:}") String mailHost) {
        this.javaMailSender = javaMailSender;
        this.mailTemplateRenderer = mailTemplateRenderer;
        this.fromName = authMailProperties.fromName();
        this.fromAddress = resolveFromAddress(authMailProperties.fromAddress(), mailUsername, mailHost);
        this.inlineLogos = authMailProperties.usesLogoUrl() ? Map.of() : loadInlineLogos();
    }

    // 기동 시 한 번만 확인한다. 리소스가 빠진 빌드여도 발송은 막지 않는다 — 이미지 자리에 alt("혼디가개")가 보인다.
    private static Map<String, ClassPathResource> loadInlineLogos() {
        Map<String, ClassPathResource> logos = new LinkedHashMap<>();
        putIfExists(logos, MailTemplateRenderer.LOGO_CONTENT_ID, MailTemplateRenderer.LOGO_RESOURCE_PATH);
        putIfExists(logos, MailTemplateRenderer.LOGO_DARK_CONTENT_ID, MailTemplateRenderer.LOGO_DARK_RESOURCE_PATH);
        return Collections.unmodifiableMap(logos);
    }

    private static void putIfExists(Map<String, ClassPathResource> logos, String contentId, String path) {
        ClassPathResource logo = new ClassPathResource(path);
        if (!logo.exists()) {
            log.error("[JavaMailSenderAdapter] 인라인 로고 리소스 없음: contentId={}, path={}", contentId, path);
            return;
        }
        logos.put(contentId, logo);
    }

    /**
     * SMTP 왕복(수 초)이 요청 스레드를 점유하지 않도록 전용 executor에서 비동기 발송한다.
     * 발송 실패는 로그로만 남긴다 — 사용자는 코드 미수신 시 쿨다운 이후 재요청한다.
     */
    @Override
    @Async("authMailTaskExecutor")
    public void sendVerificationCode(String email, String code) {
        send(email, CODE_SUBJECT, () -> mailTemplateRenderer.renderVerificationCode(code));
    }

    @Override
    @Async("authMailTaskExecutor")
    public void sendAlreadyRegisteredNotice(String email) {
        send(email, NOTICE_SUBJECT, mailTemplateRenderer::renderAlreadyRegistered);
    }

    @Override
    @Async("authMailTaskExecutor")
    public void sendPasswordResetCode(String email, String code) {
        send(email, RESET_SUBJECT, () -> mailTemplateRenderer.renderPasswordResetCode(code));
    }

    @Override
    @Async("authMailTaskExecutor")
    public void sendPasswordResetNotRegisteredNotice(String email) {
        send(email, RESET_SUBJECT, mailTemplateRenderer::renderPasswordResetNotRegistered);
    }

    @Override
    @Async("authMailTaskExecutor")
    public void sendPasswordResetSocialOnlyNotice(String email, String providerName) {
        send(email, RESET_SUBJECT, () -> mailTemplateRenderer.renderPasswordResetSocialOnly(providerName));
    }

    @Override
    @Async("authMailTaskExecutor")
    public void sendSocialLinkedNotice(String email, String providerName) {
        send(email, SOCIAL_LINKED_SUBJECT, () -> mailTemplateRenderer.renderSocialLinked(providerName));
    }

    @Override
    @Async("authMailTaskExecutor")
    public void sendPasswordRemovedNotice(String email, String providerName) {
        send(email, PASSWORD_REMOVED_SUBJECT, () -> mailTemplateRenderer.renderPasswordRemoved(providerName));
    }

    // 렌더링도 try 안에서 한다 — 템플릿 오류가 @Async 워커 밖으로 튀지 않고 발송 실패와 같은 경로로 로그만 남는다.
    private void send(String email, String subject, Supplier<String> bodySupplier) {
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            // 인라인 로고를 붙일 때만 multipart(related)로 만든다. URL 로고면 기존처럼 단일 HTML 파트다.
            MimeMessageHelper helper = new MimeMessageHelper(message, !inlineLogos.isEmpty(), "UTF-8");
            if (!fromAddress.isEmpty()) {
                helper.setFrom(fromAddress, fromName);
            }
            helper.setTo(email);
            helper.setSubject(subject);
            helper.setText(bodySupplier.get(), true);
            // addInline 은 setText 뒤에 불러야 한다 (MimeMessageHelper 계약 — 본문 파트가 먼저 있어야 한다).
            for (Map.Entry<String, ClassPathResource> logo : inlineLogos.entrySet()) {
                helper.addInline(logo.getKey(), logo.getValue(), LOGO_CONTENT_TYPE);
            }
            javaMailSender.send(message);
        } catch (Exception e) {
            log.error("[JavaMailSenderAdapter] 메일 발송 실패: email={}, subject={}, error={}", mask(email), subject, e.getMessage());
        }
    }

    /**
     * 발신 주소를 정한다. 설정값({@code auth.mail.from-address})이 있으면 그대로, 없으면 SMTP 계정에서 유도한다.
     *
     * <p>Gmail SMTP 는 {@code @gmail.com} 앞부분만으로도 인증되므로({@code .env.example} 의 {@code MAIL_USERNAME} 안내)
     * 그 경우 도메인을 붙인다. 완전한 주소를 만들지 못하면 빈 값을 돌려 From 을 넣지 않는다 — SMTP 서버가 인증 계정으로
     * 채우는 #1062 이전 동작이다. '@' 없는 값을 From 에 넣으면 서버가 발송 자체를 거부할 수 있다.
     */
    static String resolveFromAddress(String configuredAddress, String mailUsername, String mailHost) {
        if (configuredAddress != null && !configuredAddress.isBlank()) {
            return configuredAddress.trim();
        }
        if (mailUsername == null || mailUsername.isBlank()) {
            return "";
        }
        String username = mailUsername.trim();
        if (username.indexOf('@') >= 0) {
            return username;
        }
        boolean gmailHost = mailHost != null && mailHost.trim().toLowerCase(Locale.ROOT).endsWith(GMAIL_HOST_SUFFIX);
        return gmailHost ? username + GMAIL_ADDRESS_SUFFIX : "";
    }

    // 로그에 이메일 원문(PII)이 남지 않도록 로컬파트를 마스킹한다.
    private String mask(String email) {
        int atIndex = email.indexOf('@');
        if (atIndex <= 1) {
            return "***" + (atIndex >= 0 ? email.substring(atIndex) : "");
        }
        return email.charAt(0) + "***" + email.substring(atIndex);
    }
}

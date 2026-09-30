package com.hondigagae.domainlayer.auth.adapter.out.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.global.properties.AuthMailProperties;
import jakarta.mail.Address;
import jakarta.mail.Message;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * 발신자 표시·제목·실패 처리를 고정한다 (#1062). {@code @Async} 는 스프링 프록시가 거는 것이라
 * 여기서는 메서드를 직접 부른다 — 호출 스레드에서 동기로 끝난다.
 */
class JavaMailSenderAdapterTest {

    private static final String RECIPIENT = "user@example.com";

    private final JavaMailSender javaMailSender = mock(JavaMailSender.class);

    @BeforeEach
    void setUp() {
        when(javaMailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
    }

    @Test
    @DisplayName("Gmail 계정 앞부분만 설정돼 있으면 @gmail.com 을 붙여 '혼디가개' 이름으로 보낸다")
    void sendsWithDisplayNameAndGmailAddress() throws Exception {
        JavaMailSenderAdapter adapter = adapter(new AuthMailProperties(null, null, null), "hondigagae.dev", "smtp.gmail.com");

        adapter.sendVerificationCode(RECIPIENT, "123456");

        MimeMessage sent = captureSent();
        InternetAddress from = (InternetAddress) sent.getFrom()[0];
        assertThat(from.getAddress()).isEqualTo("hondigagae.dev@gmail.com");
        assertThat(from.getPersonal()).isEqualTo("혼디가개");
        assertThat(sent.getSubject()).isEqualTo("[혼디가개] 이메일 인증코드 안내");
        assertThat(sent.getRecipients(Message.RecipientType.TO)).extracting(Address::toString).containsExactly(RECIPIENT);
        assertThat(htmlBody(sent)).contains(">123456</td>", "아래 인증코드를 5분 이내에 입력해주세요.", "src=\"cid:hondigagae-logo\"");
    }

    @Test
    @DisplayName("기본은 라이트·다크 로크업 PNG 두 장을 Content-ID <hondigagae-logo>/<hondigagae-logo-dark> 인라인 파트로 붙인다")
    void attachesInlineLogoByDefault() throws Exception {
        JavaMailSenderAdapter adapter = adapter(new AuthMailProperties(null, null, null), "hondigagae.dev", "smtp.gmail.com");

        adapter.sendPasswordResetCode(RECIPIENT, "654321");

        MimeMessage sent = captureSent();
        List<Part> logoParts = leafParts(sent).stream().filter(JavaMailSenderAdapterTest::isInlineLogo).toList();
        assertThat(logoParts).extracting(JavaMailSenderAdapterTest::contentId).containsExactly("<hondigagae-logo>", "<hondigagae-logo-dark>");
        for (Part logoPart : logoParts) {
            assertThat(logoPart.getContentType()).startsWith("image/png");
            try (var logo = logoPart.getInputStream()) {
                assertThat(logo.readAllBytes()).isNotEmpty();
            }
        }
        assertThat(htmlBody(sent)).contains("src=\"cid:hondigagae-logo\"", "src=\"cid:hondigagae-logo-dark\"");
    }

    @Test
    @DisplayName("로고 URL 이 설정되면 인라인 파트 없이 단일 HTML 로 보내고 본문은 URL 을 가리킨다")
    void skipsInlineLogoWhenUrlConfigured() throws Exception {
        String logoUrl = "https://example.com/mail/logo.png";
        JavaMailSenderAdapter adapter = adapter(new AuthMailProperties(null, null, logoUrl), "hondigagae.dev", "smtp.gmail.com");

        adapter.sendVerificationCode(RECIPIENT, "123456");

        MimeMessage sent = captureSent();
        assertThat(sent.getContent()).isInstanceOf(String.class);
        assertThat(leafParts(sent)).noneMatch(JavaMailSenderAdapterTest::isInlineLogo);
        assertThat(htmlBody(sent)).contains("src=\"" + logoUrl + "\"").doesNotContain("cid:", "logo-dark-wrap\"");
    }

    @Test
    @DisplayName("from-address·from-name 을 설정하면 SMTP 계정보다 우선한다")
    void prefersConfiguredSender() throws Exception {
        JavaMailSenderAdapter adapter = adapter(new AuthMailProperties("혼디가개 알림", "no-reply@hondigagae.kr", null), "hondigagae.dev", "smtp.gmail.com");

        adapter.sendSocialLinkedNotice(RECIPIENT, "카카오");

        MimeMessage sent = captureSent();
        InternetAddress from = (InternetAddress) sent.getFrom()[0];
        assertThat(from.getAddress()).isEqualTo("no-reply@hondigagae.kr");
        assertThat(from.getPersonal()).isEqualTo("혼디가개 알림");
        assertThat(sent.getSubject()).isEqualTo("[혼디가개] 소셜 로그인 연결 안내");
    }

    @Test
    @DisplayName("발신 주소를 정하지 못하면 From 을 넣지 않는다 — SMTP 서버가 인증 계정으로 채운다")
    void skipsFromWhenAddressBlank() throws Exception {
        JavaMailSenderAdapter adapter = adapter(new AuthMailProperties(null, null, null), "", "smtp.gmail.com");

        adapter.sendAlreadyRegisteredNotice(RECIPIENT);

        MimeMessage sent = captureSent();
        assertThat(sent.getHeader("From")).isNull();
        assertThat(sent.getSubject()).isEqualTo("[혼디가개] 회원가입 안내");
    }

    @Test
    @DisplayName("7종 메일의 제목은 기존 그대로다")
    void keepsSubjects() throws Exception {
        JavaMailSenderAdapter adapter = adapter(new AuthMailProperties(null, null, null), "", "");

        adapter.sendPasswordResetCode(RECIPIENT, "654321");
        assertThat(captureSent().getSubject()).isEqualTo("[혼디가개] 비밀번호 재설정 안내");
        adapter.sendPasswordResetNotRegisteredNotice(RECIPIENT);
        assertThat(captureSent().getSubject()).isEqualTo("[혼디가개] 비밀번호 재설정 안내");
        adapter.sendPasswordResetSocialOnlyNotice(RECIPIENT, "네이버");
        assertThat(captureSent().getSubject()).isEqualTo("[혼디가개] 비밀번호 재설정 안내");
        adapter.sendPasswordRemovedNotice(RECIPIENT, "네이버");
        assertThat(captureSent().getSubject()).isEqualTo("[혼디가개] 소셜 전용 계정 전환 안내");
    }

    @Test
    @DisplayName("SMTP 발송이 실패해도 예외를 밖으로 던지지 않는다")
    void swallowsSendFailure() {
        doThrow(new MailSendException("smtp down")).when(javaMailSender).send(any(MimeMessage.class));
        JavaMailSenderAdapter adapter = adapter(new AuthMailProperties(null, null, null), "hondigagae.dev", "smtp.gmail.com");

        assertThatCode(() -> adapter.sendPasswordResetCode(RECIPIENT, "123456")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("발신 주소 유도 규칙")
    void resolvesFromAddress() {
        assertThat(JavaMailSenderAdapter.resolveFromAddress(" no-reply@hondigagae.kr ", "someone", "smtp.gmail.com")).isEqualTo("no-reply@hondigagae.kr");
        assertThat(JavaMailSenderAdapter.resolveFromAddress("", "someone@naver.com", "smtp.naver.com")).isEqualTo("someone@naver.com");
        assertThat(JavaMailSenderAdapter.resolveFromAddress(null, "someone", "SMTP.GMAIL.COM")).isEqualTo("someone@gmail.com");
        // Gmail 이 아닌데 도메인이 없으면 완전한 주소를 만들 수 없다 — From 을 넣지 않는다.
        assertThat(JavaMailSenderAdapter.resolveFromAddress(null, "someone", "smtp.naver.com")).isEmpty();
        assertThat(JavaMailSenderAdapter.resolveFromAddress(null, " ", "smtp.gmail.com")).isEmpty();
    }

    // multipart 를 끝까지 내려가 잎 파트(본문·첨부)만 모은다. 단일 파트 메일이면 메시지 자신이다.
    private static List<Part> leafParts(Part part) throws Exception {
        if (!(part.getContent() instanceof Multipart multipart)) {
            return List.of(part);
        }
        List<Part> leaves = new ArrayList<>();
        for (int i = 0; i < multipart.getCount(); i++) {
            leaves.addAll(leafParts(multipart.getBodyPart(i)));
        }
        return leaves;
    }

    private static String htmlBody(Part message) throws Exception {
        for (Part part : leafParts(message)) {
            if (part.isMimeType("text/html")) {
                return (String) part.getContent();
            }
        }
        throw new AssertionError("text/html 파트가 없다");
    }

    private static boolean isInlineLogo(Part part) {
        String contentId = contentId(part);
        return contentId != null && contentId.startsWith("<hondigagae-logo");
    }

    private static String contentId(Part part) {
        try {
            String[] contentId = part.getHeader("Content-ID");
            return contentId == null ? null : contentId[0];
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private JavaMailSenderAdapter adapter(AuthMailProperties properties, String mailUsername, String mailHost) {
        return new JavaMailSenderAdapter(javaMailSender, new MailTemplateRenderer(properties), properties, mailUsername, mailHost);
    }

    // 매 호출 직후 부르면 마지막으로 보낸 메시지가 된다. Content-Type 등 헤더는 saveChanges 때 채워진다
    // (실제 발송에서는 JavaMailSender 가 부른다).
    private MimeMessage captureSent() throws Exception {
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(javaMailSender, atLeastOnce()).send(captor.capture());
        MimeMessage sent = captor.getValue();
        sent.saveChanges();
        return sent;
    }
}

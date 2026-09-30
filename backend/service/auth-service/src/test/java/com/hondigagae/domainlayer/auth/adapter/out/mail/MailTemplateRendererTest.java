package com.hondigagae.domainlayer.auth.adapter.out.mail;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.global.properties.AuthMailProperties;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

/**
 * 메일 템플릿이 실제 Thymeleaf 엔진으로 끝까지 렌더링되는지 본다 (#1062).
 *
 * <p>템플릿은 컴파일로 검증되지 않는다 — 조각 표현식 오타·빠진 변수는 발송 시점에야 드러나고, 그때는
 * 어댑터가 예외를 삼켜 로그 한 줄만 남는다. 그래서 스프링 없이 엔진만 띄워 7종을 모두 그려 본다.
 */
class MailTemplateRendererTest {

    private static final String LOGO_URL = "https://example.com/mail/logo.png";

    private final MailTemplateRenderer renderer = new MailTemplateRenderer(new AuthMailProperties(null, null, null));
    private final MailTemplateRenderer rendererWithLogo = new MailTemplateRenderer(new AuthMailProperties(null, null, LOGO_URL));

    @Test
    @DisplayName("7종 메일이 모두 레이아웃과 함께 렌더링되고 템플릿 문법이 남지 않는다")
    void rendersAllMails() {
        List<String> bodies = List.of(
            renderer.renderVerificationCode("123456"), renderer.renderAlreadyRegistered(),
            renderer.renderPasswordResetCode("654321"), renderer.renderPasswordResetNotRegistered(),
            renderer.renderPasswordResetSocialOnly("카카오"), renderer.renderSocialLinked("카카오"),
            renderer.renderPasswordRemoved("카카오")
        );

        assertThat(bodies).allSatisfy(body -> assertThat(body)
            .startsWith("<!DOCTYPE html>")
            .contains("lang=\"ko\"", "src=\"cid:hondigagae-logo\"", "alt=\"혼디가개\"", "max-width:480px", "이 메일은 발신 전용입니다.", "© 혼디가개")
            .doesNotContain("xmlns:th", "${", "var(--", "<!--")
            // "width:" 도 "th:" 를 품으므로 속성 경계(공백) 뒤의 th: 만 본다.
            .doesNotContainPattern("\\sth:"));
    }

    @Test
    @DisplayName("인증코드 메일은 코드와 기존 문구를 담고 미리보기 문구에도 코드를 넣는다")
    void rendersVerificationCode() {
        String body = renderer.renderVerificationCode("123456");

        assertThat(body)
            .contains("<title>혼디가개 이메일 인증</title>", "아래 인증코드를 5분 이내에 입력해주세요.", ">123456</td>")
            .contains("인증코드 123456", "본인이 요청하지 않았다면 이 메일을 무시해주세요.", "#EEF0F3");
    }

    @Test
    @DisplayName("비밀번호 재설정 코드 메일은 코드와 '비밀번호는 변경되지 않습니다' 안내를 담는다")
    void rendersPasswordResetCode() {
        String body = renderer.renderPasswordResetCode("654321");

        assertThat(body)
            .contains("혼디가개 비밀번호 재설정", "아래 인증코드를 5분 이내에 입력하고 새 비밀번호를 설정해주세요.", ">654321</td>")
            .contains("비밀번호는 변경되지 않습니다.");
    }

    @Test
    @DisplayName("안내 메일 두 종은 기존 문구를 그대로 담는다")
    void rendersNotices() {
        assertThat(renderer.renderAlreadyRegistered())
            .contains("혼디가개 회원가입 안내", "이 이메일로는 이미 가입된 계정이 있습니다.", "비밀번호를 잊으셨다면 로그인 화면에서 비밀번호 찾기를 이용해주세요.");
        assertThat(renderer.renderPasswordResetNotRegistered())
            .contains("혼디가개 비밀번호 재설정 안내", "이 이메일로 가입된 계정이 없습니다.", "이메일 주소를 다시 확인하시거나, 회원가입을 진행해주세요.");
    }

    @Test
    @DisplayName("provider 이름이 들어가는 메일 세 종은 이름을 문장 안에 넣는다")
    void rendersProviderMails() {
        assertThat(renderer.renderPasswordResetSocialOnly("네이버"))
            .contains("이 계정은 <b>네이버 로그인</b>으로 가입되어 별도의 비밀번호가 없습니다.", "<span>네이버 로그인</span>을 이용해주세요.");
        assertThat(renderer.renderSocialLinked("네이버"))
            .contains("회원님의 계정에 <b>네이버 로그인</b>이 연결되었습니다.", "본인이 한 것이 아니라면 즉시 비밀번호를 변경해주세요.", "#B91C1C");
        assertThat(renderer.renderPasswordRemoved("네이버"))
            .contains("<b>네이버 전용 계정</b>으로 전환되어 비밀번호가 제거되었습니다.", "보안을 위해 모든 기기에서 로그아웃되었습니다.")
            .contains("<span>네이버 계정</span>의 보안 상태를 확인해주세요.", "#B91C1C");
    }

    @Test
    @DisplayName("동적 값은 이스케이프된다 — provider 이름에 마크업이 와도 태그로 해석되지 않는다")
    void escapesDynamicValues() {
        String hostile = "<script>x</script>";

        assertThat(List.of(renderer.renderPasswordResetSocialOnly(hostile), renderer.renderSocialLinked(hostile), renderer.renderPasswordRemoved(hostile)))
            .allSatisfy(body -> assertThat(body).contains("&lt;script&gt;x&lt;/script&gt;").doesNotContain("<script>"));
        assertThat(renderer.renderVerificationCode("<b>1</b>")).contains("&lt;b&gt;1&lt;/b&gt;").doesNotContain("<b>1</b>");
    }

    @Test
    @DisplayName("로고는 기본으로 라이트·다크 두 CID 를 가리키고, 다크 쪽은 인라인 스타일로 숨겨 둔다")
    void rendersInlineLogoPair() {
        assertThat(renderer.renderVerificationCode("123456"))
            .contains("<img class=\"logo-light\" src=\"cid:" + MailTemplateRenderer.LOGO_CONTENT_ID + "\"", "width=\"155\"", "height=\"35\"")
            .contains("<div class=\"logo-dark-wrap\" style=\"display:none; mso-hide:all; max-height:0; overflow:hidden;\">")
            .contains("src=\"cid:" + MailTemplateRenderer.LOGO_DARK_CONTENT_ID + "\"")
            .doesNotContain(LOGO_URL);
    }

    @Test
    @DisplayName("로고 URL 이 설정되면 그 URL 하나만 쓰고 다크 교체 블록은 그리지 않는다")
    void rendersOnlyUrlLogoWhenConfigured() {
        assertThat(rendererWithLogo.renderVerificationCode("123456"))
            .contains("<img class=\"logo-light\" src=\"" + LOGO_URL + "\"")
            .doesNotContain("cid:", "<div class=\"logo-dark-wrap\"");
    }

    @Test
    @DisplayName("다크 모드 덮어쓰기 스타일과 color-scheme 선언이 있다 — 기본 라이트 스타일은 인라인 그대로다")
    void declaresDarkModeOverrides() {
        String body = renderer.renderSocialLinked("카카오");

        assertThat(body)
            .contains("<meta name=\"color-scheme\" content=\"light dark\">", "<meta name=\"supported-color-schemes\" content=\"light dark\">")
            .contains("@media (prefers-color-scheme: dark)", ".logo-light { display:none !important; }", "[data-ogsc] .logo-dark-wrap")
            .contains("class=\"m-card\" style=\"background-color:#FFFFFF;", "class=\"m-warn\"", "#B91C1C");
        assertThat(renderer.renderVerificationCode("123456")).contains("class=\"m-code\"", "background-color:#EEF0F3;");
    }

    @Test
    @DisplayName("워드마크는 라이브 텍스트로 그리지 않는다 — 로크업 이미지 하나뿐이다")
    void hasNoLiveTextWordmark() {
        String body = renderer.renderAlreadyRegistered();

        // 브랜드 규칙: 외부 노출은 로크업 이미지. 예전 텍스트 워드마크(<span ...>혼디가개</span>)가 돌아오면 깨진다.
        assertThat(body).doesNotContain(">혼디가개</span>", "#237A54");
        // 라이트·다크 로크업 두 장 외의 이미지는 없다.
        assertThat(body.split("<img", -1)).hasSize(3);
    }

    @Test
    @DisplayName("공백뿐인 로고 URL 은 설정되지 않은 것으로 보고 인라인 로고를 쓴다")
    void treatsBlankLogoUrlAsInline() {
        MailTemplateRenderer blankLogo = new MailTemplateRenderer(new AuthMailProperties(" ", " ", "  "));

        assertThat(blankLogo.renderAlreadyRegistered()).contains("src=\"cid:hondigagae-logo\"");
    }

    @Test
    @DisplayName("인라인 로고 PNG 두 장이 클래스패스에 있다")
    void inlineLogoResourceExists() {
        assertThat(new ClassPathResource(MailTemplateRenderer.LOGO_RESOURCE_PATH).exists()).isTrue();
        assertThat(new ClassPathResource(MailTemplateRenderer.LOGO_DARK_RESOURCE_PATH).exists()).isTrue();
    }
}

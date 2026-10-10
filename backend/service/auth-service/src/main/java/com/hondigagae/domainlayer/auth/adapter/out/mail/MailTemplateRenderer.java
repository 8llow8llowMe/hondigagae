package com.hondigagae.domainlayer.auth.adapter.out.mail;

import com.hondigagae.global.properties.AuthMailProperties;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

/**
 * 인증 메일 본문을 {@code classpath:templates/mail/*.html} Thymeleaf 템플릿으로 렌더링한다 (#1062).
 *
 * <p>엔진은 빈으로 올리지 않고 이 클래스 안에만 둔다. REST 서비스라 MVC 뷰 리졸버가 없고, 다른 곳에서
 * {@code TemplateEngine} 을 주입받을 일이 없어서 빈 이름·타입 충돌 여지를 아예 만들지 않는다.
 *
 * <p>동적 값(인증코드, provider 이름)은 템플릿에서 전부 {@code th:text} 로만 출력한다 — 이스케이프된다.
 */
@Component
public class MailTemplateRenderer {

    private static final String TEMPLATE_PREFIX = "templates/mail/";
    private static final String TEMPLATE_SUFFIX = ".html";

    /** 인라인 로고 파트의 Content-ID. 템플릿의 {@code cid:} 참조와 어댑터의 {@code addInline} 이 같은 값을 써야 한다. */
    public static final String LOGO_CONTENT_ID = "hondigagae-logo";
    /** 인라인 로고 원본 — {@code frontend/docs/hondi_img/logo-lockup.svg} 를 3배(633x144)로 래스터화한 투명 PNG. */
    public static final String LOGO_RESOURCE_PATH = "mail/logo-lockup.png";
    /** 다크 모드용 인라인 로고의 Content-ID. */
    public static final String LOGO_DARK_CONTENT_ID = "hondigagae-logo-dark";
    /** 다크 모드용 로고 — 워드마크를 흰색으로 칠한 같은 크기의 투명 PNG. */
    public static final String LOGO_DARK_RESOURCE_PATH = "mail/logo-lockup-dark.png";

    private final TemplateEngine templateEngine;
    private final String logoSrc;
    // null 이면 다크 로고 교체 블록을 그리지 않는다.
    private final String logoDarkSrc;

    public MailTemplateRenderer(AuthMailProperties authMailProperties) {
        this.templateEngine = createTemplateEngine();
        // 로고는 항상 있다. URL 이 설정되면 그 이미지를, 아니면 어댑터가 붙이는 인라인 파트를 가리킨다.
        // URL 로고에는 다크 짝이 없으므로 다크 교체를 아예 끈다 — 라이트 로고가 모든 모드에서 그대로 보인다.
        boolean usesLogoUrl = authMailProperties.usesLogoUrl();
        this.logoSrc = usesLogoUrl ? authMailProperties.logoUrl() : "cid:" + LOGO_CONTENT_ID;
        this.logoDarkSrc = usesLogoUrl ? null : "cid:" + LOGO_DARK_CONTENT_ID;
    }

    public String renderVerificationCode(String code) {
        return render("verification-code", Map.of("code", code));
    }

    public String renderAlreadyRegistered() {
        return render("already-registered", Map.of());
    }

    public String renderPasswordResetCode(String code) {
        return render("password-reset-code", Map.of("code", code));
    }

    public String renderPasswordResetNotRegistered() {
        return render("password-reset-not-registered", Map.of());
    }

    public String renderPasswordResetSocialOnly(String providerName) {
        return render("password-reset-social-only", Map.of("providerName", providerName));
    }

    public String renderSocialLinked(String providerName) {
        return render("social-linked", Map.of("providerName", providerName));
    }

    public String renderPasswordRemoved(String providerName) {
        return render("password-removed", Map.of("providerName", providerName));
    }

    private String render(String templateName, Map<String, Object> variables) {
        Context context = new Context(Locale.KOREAN);
        context.setVariables(variables);
        context.setVariable("logoSrc", logoSrc);
        context.setVariable("logoDarkSrc", logoDarkSrc);
        return templateEngine.process(templateName, context);
    }

    private static TemplateEngine createTemplateEngine() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix(TEMPLATE_PREFIX);
        resolver.setSuffix(TEMPLATE_SUFFIX);
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding(StandardCharsets.UTF_8.name());
        resolver.setCacheable(true);
        // 없는 템플릿 이름은 조용히 넘어가지 않고 렌더링 시점에 예외로 드러낸다.
        resolver.setCheckExistence(true);

        TemplateEngine engine = new TemplateEngine();
        engine.setTemplateResolver(resolver);
        return engine;
    }
}

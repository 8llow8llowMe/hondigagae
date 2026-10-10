package com.hondigagae.apigateway.log;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.PatternLayout;
import ch.qos.logback.classic.encoder.PatternLayoutEncoder;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.LoggingEvent;
import ch.qos.logback.core.Appender;
import ch.qos.logback.core.OutputStreamAppender;
import ch.qos.logback.core.util.OptionHelper;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.reactive.server.WebTestClient;

/**
 * 공유 링크 토큰이 <b>콘솔로 실제로 나가는 문자열</b>에 남지 않는지 끝까지 본다 (#1281).
 *
 * <p>실제 앱 컨텍스트라 {@code logback-spring.xml} 이 적용되고, 요청은 {@code HttpWebHandlerAdapter} 부터 실제 체인을 탄다.
 * 그래서 {@code ExceptionHandlingWebHandler} 의 체크포인트가 같은 Throwable 에 suppressed 로 붙고, 부트 오류 핸들러의 500 ERROR 가
 * 스택트레이스와 함께 그대로 찍힌다. 공유 라우트의 업스트림을 닿을 수 없는 주소로 두면 #1281 의 재현 경로(업스트림 실패 → 500)가
 * 된다. 이 테스트 환경(MOCK 웹)에서는 연결 전 이름 해석 단계에서 {@code UnknownHostException} 으로 실패하는데, 실패 지점과 무관하게
 * 같은 오류 경로(체크포인트 → 부트 500 ERROR)를 탄다. 이 테스트는 {@code handle()} 을 직접 부르지 않는다 — 직접 부르면 체크포인트가
 * 끼지 않아 스택트레이스로 새는 것을 놓친다.
 *
 * <p>라우트는 인라인 프로퍼티로 <b>목록 전체를 바꾼다</b> — 바인딩은 우선순위가 가장 높은 출처의 목록을 통째로 쓴다. 레이트 리밋
 * 필터가 없어 Redis 에 닿지 않는다.
 */
@SpringBootTest(webEnvironment = WebEnvironment.MOCK, properties = {
    "eureka.client.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "spring.cloud.config.enabled=false",
    "spring.cloud.gateway.routes[0].id=plan-service-shared-plans",
    "spring.cloud.gateway.routes[0].uri=http://127.0.0.1:1",
    "spring.cloud.gateway.routes[0].predicates[0]=Path=/api/v1/shared-plans/**"
})
@AutoConfigureWebTestClient(timeout = "30s")
@ExtendWith(OutputCaptureExtension.class)
class ShareTokenLogOutputTest {

    private static final String TOKEN = "b3RoZXJfdG9rZW5fZXhhbXBsZV92YWx1ZV8wMTIzNDU2Nzg";
    private static final String QUERY_TOKEN = "Zm9vYmFyX3Rva2VuX3NlY29uZF9leGFtcGxlXzAxMjM0NTY";

    /** 체크포인트 suppressed 가 찍힐 때마다 한 번 나오는 줄 — 스택트레이스가 두 번 붙으면 두 번 나온다. */
    private static final String CHECKPOINT_HEADER = "Error has been observed at the following site(s):";

    @Autowired
    private WebTestClient webTestClient;

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/shared-plans/", "/api/v1/shared-%70lans/"})
    @DisplayName("업스트림 연결 실패로 500 이 나도 콘솔 출력(메시지·스택트레이스·Suppressed) 어디에도 공유 토큰이 없다")
    void upstreamFailureLeavesNoShareTokenInConsole(String sharedPrefix, CapturedOutput output) {
        int before = output.length();

        // 문자열 URI 는 % 를 다시 인코딩한다. 원문 표기를 그대로 보내려고 URI 로 넘긴다.
        webTestClient.get().uri(URI.create("http://localhost" + sharedPrefix + TOKEN + "?token=" + QUERY_TOKEN))
            .exchange()
            .expectStatus().isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);

        String console = output.toString().substring(before);
        String maskedTarget = "HTTP GET \"" + sharedPrefix + "***?token=***\"";
        assertThat(console).doesNotContain(TOKEN).doesNotContain(QUERY_TOKEN);
        assertThat(console).as("부트 오류 핸들러의 500 ERROR").contains("500 Server Error for " + maskedTarget);
        assertThat(console).as("스택트레이스 Suppressed 아래 체크포인트").contains(maskedTarget + " [ExceptionHandlingWebHandler]");
        assertThat(occurrences(console, CHECKPOINT_HEADER)).as("스택트레이스는 한 번만 찍힌다").isEqualTo(1);
    }

    @Test
    @DisplayName("콘솔 패턴은 Boot 기본 패턴에서 메시지·예외 부분만 %maskShareToken(...) 으로 감싼 것이다")
    void consolePatternIsBootDefaultWithMessageWrapped() throws Exception {
        LoggerContext loggerContext = (LoggerContext) LoggerFactory.getILoggerFactory();
        String bootDefault = bootDefaultConsolePattern(loggerContext);
        int messageAt = bootDefault.indexOf("%m%n");
        assertThat(messageAt).as("Boot 기본 패턴의 메시지 자리").isPositive();

        assertThat(gatewayConsolePattern(loggerContext))
            .isEqualTo(bootDefault.substring(0, messageAt) + "%maskShareToken(" + bootDefault.substring(messageAt) + ")");
    }

    @Test
    @DisplayName("토큰 없는 줄은 Boot 기본 패턴과 글자 하나 다르지 않게 찍히고, 스택트레이스도 한 번만 붙는다")
    void tokenFreeEventsRenderLikeBootDefault() throws Exception {
        LoggerContext loggerContext = (LoggerContext) LoggerFactory.getILoggerFactory();
        // 같은 컨텍스트·같은 이벤트로 렌더한다 — 색상(AnsiOutput)·PID·스레드·시각 같은 환경 값이 양쪽에 똑같이 들어간다.
        PatternLayout bootDefault = layout(loggerContext, bootDefaultConsolePattern(loggerContext));
        PatternLayout gateway = layout(loggerContext, gatewayConsolePattern(loggerContext));
        Logger probe = loggerContext.getLogger("com.hondigagae.apigateway.log.ConsoleParityProbe");

        IllegalStateException failure = new IllegalStateException("boom", new IllegalArgumentException("cause"));
        failure.addSuppressed(new RuntimeException("suppressed"));
        List<ILoggingEvent> events = List.of(
            new LoggingEvent(Logger.class.getName(), probe, Level.INFO, "[요청] 경로={} 상태={}", null, new Object[] {"/api/v1/plans/1", 200}),
            new LoggingEvent(Logger.class.getName(), probe, Level.ERROR, "[id-1] 500 Server Error for HTTP GET \"/api/v1/plans/1\"", failure, null));

        for (ILoggingEvent event : events) {
            assertThat(gateway.doLayout(event)).isEqualTo(bootDefault.doLayout(event));
        }
        assertThat(occurrences(gateway.doLayout(events.get(1)), "java.lang.IllegalStateException: boom"))
            .as("컴포지트 안의 %wEx 를 logback 이 알아보고 스택트레이스를 한 번 더 붙이지 않는다").isEqualTo(1);
    }

    private static String bootDefaultConsolePattern(LoggerContext loggerContext) throws Exception {
        String defaults = new String(new ClassPathResource("org/springframework/boot/logging/logback/defaults.xml").getInputStream().readAllBytes(),
            StandardCharsets.UTF_8);
        Matcher pattern = Pattern.compile("<property name=\"CONSOLE_LOG_PATTERN\" value=\"([^\"]*)\"/>").matcher(defaults);
        assertThat(pattern.find()).as("Boot defaults.xml 에 CONSOLE_LOG_PATTERN 이 있다").isTrue();
        return OptionHelper.substVars(pattern.group(1), loggerContext);
    }

    private static String gatewayConsolePattern(LoggerContext loggerContext) {
        Appender<ILoggingEvent> appender = loggerContext.getLogger(Logger.ROOT_LOGGER_NAME).getAppender("CONSOLE");
        if (appender instanceof OutputStreamAppender<ILoggingEvent> console && console.getEncoder() instanceof PatternLayoutEncoder encoder) {
            return encoder.getPattern();
        }
        throw new AssertionError("콘솔 appender 가 PatternLayoutEncoder 를 쓰지 않는다: " + appender);
    }

    private static PatternLayout layout(LoggerContext loggerContext, String pattern) {
        PatternLayout layout = new PatternLayout();
        layout.setContext(loggerContext);
        layout.setPattern(pattern);
        layout.start();
        return layout;
    }

    private static int occurrences(String text, String needle) {
        int count = 0;
        for (int at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + needle.length())) {
            count++;
        }
        return count;
    }
}

package com.hondigagae.apigateway.filter;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * 공유 토큰이 게이트웨이 로그에 평문으로 남지 않는지 고정한다 (#627).
 *
 * <p>{@code /api/v1/shared-plans/{token}} 의 토큰은 <b>그 자체가 열람 권한</b>이다 — 인증 없이
 * 토큰만으로 남의 일정이 열린다. 이 필터는 요청 URI 와 응답 경로를 INFO 로 남기므로, 마스킹이
 * 빠지면 Loki 를 볼 수 있는 사람이 곧 그 일정을 볼 수 있는 사람이 된다. 같은 필터가
 * {@code Authorization} 을 값 없이 존재 여부만 찍는 것과 같은 취지다.
 *
 * <p>실제로 나가는 로그 문자열을 본다 — 헬퍼만 따로 보면 "두 로그 중 한쪽에만 걸었다" 를 놓친다.
 */
class LoggingGlobalApiGatewayFilterTest {

    private static final String TOKEN = "b3RoZXJfdG9rZW5fZXhhbXBsZV92YWx1ZV8wMTIzNDU2Nzg";

    private LoggingGlobalApiGatewayFilter filter;
    private Logger logger;
    private ListAppender<ILoggingEvent> appender;

    @BeforeEach
    void setUp() {
        filter = new LoggingGlobalApiGatewayFilter();
        logger = (Logger) LoggerFactory.getLogger(LoggingGlobalApiGatewayFilter.class);
        appender = new ListAppender<>();
        appender.start();
        logger.setLevel(Level.INFO);
        logger.addAppender(appender);
    }

    @AfterEach
    void tearDown() {
        logger.detachAppender(appender);
    }

    @Test
    @DisplayName("공유 링크 토큰은 요청·응답 로그 어디에도 남지 않는다")
    void masksSharedPlanTokenInBothLogs() {
        String rendered = runFilterAndRenderLogs("/api/v1/shared-plans/" + TOKEN);

        assertThat(rendered).doesNotContain(TOKEN);
        // 경로 자체는 남아야 장애를 추적할 수 있다 — 가리는 것은 토큰 세그먼트 하나뿐이다.
        assertThat(rendered).contains("/api/v1/shared-plans/***");
    }

    @Test
    @DisplayName("토큰 뒤에 세그먼트나 쿼리가 붙어도 토큰만 가리고 나머지는 남는다")
    void masksOnlyTheTokenSegment() {
        String rendered = runFilterAndRenderLogs("/api/v1/shared-plans/" + TOKEN + "/items?debug=1");

        assertThat(rendered).doesNotContain(TOKEN);
        assertThat(rendered).contains("/api/v1/shared-plans/***/items");
        assertThat(rendered).contains("debug=1");
    }

    @Test
    @DisplayName("토큰 없이 접두어만 온 요청은 그대로 남는다 — 가릴 세그먼트가 없다")
    void leavesPrefixOnlyPathUntouched() {
        String rendered = runFilterAndRenderLogs("/api/v1/shared-plans/");

        assertThat(rendered).contains("/api/v1/shared-plans/");
        assertThat(rendered).doesNotContain("***");
    }

    @Test
    @DisplayName("쿼리스트링의 token= 값도 가려진다 — 지금 계약엔 없지만 장래 회귀 경로다")
    void masksTokenQueryParameter() {
        String rendered = runFilterAndRenderLogs("/api/v1/shared-plans?token=" + TOKEN + "&trace=abc");

        assertThat(rendered).doesNotContain(TOKEN);
        assertThat(rendered).contains("token=***");
        // 다른 파라미터는 남는다 — 장애 추적에 필요하다.
        assertThat(rendered).contains("trace=abc");
    }

    @Test
    @DisplayName("공유 경로가 아니어도 token= 파라미터는 가린다")
    void masksTokenQueryParameterOnAnyPath() {
        String rendered = runFilterAndRenderLogs("/api/v1/plans?token=" + TOKEN);

        assertThat(rendered).doesNotContain(TOKEN);
        assertThat(rendered).contains("token=***");
    }

    @Test
    @DisplayName("다른 경로는 건드리지 않는다")
    void leavesOtherPathsUntouched() {
        String rendered = runFilterAndRenderLogs("/api/v1/plans/1234567890123456789");

        assertThat(rendered).contains("/api/v1/plans/1234567890123456789");
        assertThat(rendered).doesNotContain("***");
    }

    private String runFilterAndRenderLogs(String path) {
        MockServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get(path).build());

        filter.filter(exchange, ignored -> Mono.empty()).block();

        List<ILoggingEvent> events = appender.list;
        assertThat(events).as("요청 로그와 응답 로그가 모두 남아야 한다").hasSizeGreaterThanOrEqualTo(2);
        return events.stream().map(ILoggingEvent::getFormattedMessage).reduce("", (left, right) -> left + "\n" + right);
    }
}

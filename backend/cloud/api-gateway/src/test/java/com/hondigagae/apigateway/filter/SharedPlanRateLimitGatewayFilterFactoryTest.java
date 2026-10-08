package com.hondigagae.apigateway.filter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.apigateway.exception.GatewayErrorCode;
import com.hondigagae.apigateway.ratelimit.SharedPlanTokenKeyResolver;
import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BiFunction;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.ratelimit.AbstractRateLimiter;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RateLimiter;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Scheduler;
import reactor.core.scheduler.Schedulers;

/**
 * 공유 링크 레이트 리밋이 <b>실제로 나가는 응답</b>까지 검증한다 (#1244).
 *
 * <p>판정 자체(토큰 버킷)는 {@code RedisRateLimiter} 의 몫이라 가짜로 갈아 끼운다 — Redis 장애 때의 fail-open 은
 * 라이브러리 동작이라 {@code RateLimitFailOpenTest} 가 실제 리미터로 본다. 여기서 고정하는 것은 이 필터가 책임지는 다섯이다.
 * <ul>
 *   <li><b>거부는 429 + 공통 봉투({@code GATEWAY_001})</b> — 기본 {@code RequestRateLimiter} 는 빈 본문이라
 *       프론트 파서가 사유를 잃는다 (api-design-guide §2-2). 거부는 WARN 을 쓰지 않는다 — 거부 폭주가 로그 폭주가 된다</li>
 *   <li><b>허용은 체인을 정확히 한 번 탄다</b> — 빈 {@code Mono} 를 "키 없음" 으로 오인하면 업스트림을 두 번 부른다</li>
 *   <li><b>키가 없으면 판정 없이 통과</b> — 기본 필터의 deny-empty-key(403)와 반대다</li>
 *   <li><b>판정이 실패하면 통과 + WARN 한 줄</b> — 오류 신호든 동기 예외든. 로그에 토큰 원문이 없다</li>
 *   <li><b>판정은 이벤트 루프 밖에서 구독된다</b> (#1253) — 리미터는 구독 시점에 Redis 공유 연결을 얻는데, 첫 연결은
 *       연결 팩토리의 락 아래에서 동기로 맺는다. 이벤트 루프가 그 락을 기다리면 그 루프의 다른 요청이 함께 멈춘다</li>
 * </ul>
 */
class SharedPlanRateLimitGatewayFilterFactoryTest {

    private static final String ROUTE_ID = "plan-service-shared-plans";
    private static final String KEY = "hondigagae:test:shared-plan:0123456789abcdef0123456789abcdef";

    /** 발급 형식(43자)의 토큰. 실제 리졸버를 쓰는 테스트에서 로그에 원문이 새는지 본다. */
    private static final String TOKEN = "aG9uZGlnYWdhZS1zaGFyZWQtcGxhbi10b2tlbi0jMDE";
    private static final String SHARED_PLAN_PATH = "/api/v1/shared-plans/" + TOKEN;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private RecordingRateLimiter rateLimiter;

    /** 체인에 도달한 횟수. 거부면 0, 통과면 정확히 1 이어야 한다. */
    private AtomicInteger forwarded;

    private Logger logger;
    private ListAppender<ILoggingEvent> appender;
    private Level previousLevel;

    /** Netty 이벤트 루프 흉내 — Reactor 가 블로킹 금지(NonBlocking)로 표시하는 스레드 하나다. */
    private Scheduler eventLoop;

    @BeforeEach
    void setUp() {
        rateLimiter = new RecordingRateLimiter();
        forwarded = new AtomicInteger();

        logger = (Logger) LoggerFactory.getLogger(SharedPlanRateLimitGatewayFilterFactory.class);
        previousLevel = logger.getLevel();
        logger.setLevel(Level.DEBUG);
        appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        eventLoop = Schedulers.newSingle("fake-event-loop");
    }

    @AfterEach
    void tearDown() {
        logger.detachAppender(appender);
        logger.setLevel(previousLevel);
        eventLoop.dispose();
    }

    @Test
    @DisplayName("거부는 429 + JSON 봉투 + GATEWAY_001 이고 업스트림까지 가지 않는다")
    void rejectionYieldsTooManyRequestsEnvelope() throws Exception {
        rateLimiter.answer(false, limiterHeaders("0"));

        MockServerWebExchange exchange = dispatch(fixedKey(), routeConfig(), SHARED_PLAN_PATH);

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(exchange.getResponse().getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_JSON);
        JsonNode body = objectMapper.readTree(body(exchange));
        assertThat(body.at("/dataHeader/success").asBoolean(true)).isFalse();
        assertThat(body.at("/dataHeader/resultCode").asText()).isEqualTo("GATEWAY_001");
        assertThat(body.at("/dataHeader/resultMessage").asText()).isEqualTo(GatewayErrorCode.RATE_LIMITED.getMessage());
        assertThat(body.at("/dataHeader/fieldErrors").isNull()).as("검증 오류가 아니면 fieldErrors 는 null 이다").isTrue();
        assertThat(body.at("/dataBody").isNull()).isTrue();
        assertThat(forwarded.get()).as("거부된 요청은 업스트림까지 가지 않는다").isZero();
    }

    @Test
    @DisplayName("거부 응답에도 X-RateLimit-* 헤더가 실린다")
    void rejectionCarriesRateLimitHeaders() {
        rateLimiter.answer(false, limiterHeaders("0"));

        MockServerWebExchange exchange = dispatch(fixedKey(), routeConfig(), SHARED_PLAN_PATH);

        assertThat(exchange.getResponse().getHeaders().getFirst("X-RateLimit-Remaining")).isEqualTo("0");
        assertThat(exchange.getResponse().getHeaders().getFirst("X-RateLimit-Burst-Capacity")).isEqualTo("20");
        assertThat(exchange.getResponse().getHeaders().getFirst("X-RateLimit-Replenish-Rate")).isEqualTo("2");
    }

    @Test
    @DisplayName("거부는 DEBUG 로만 남긴다 — 거부 폭주가 이 기능의 전제라 WARN 이면 로그가 같이 폭주한다")
    void rejectionIsNotLoggedAboveDebug() {
        rateLimiter.answer(false, limiterHeaders("0"));

        dispatch(fixedKey(), routeConfig(), SHARED_PLAN_PATH);

        assertThat(appender.list).extracting(ILoggingEvent::getLevel).containsOnly(Level.DEBUG);
        assertThat(appender.list).hasSize(1);
    }

    @Test
    @DisplayName("허용은 X-RateLimit-* 헤더를 달고 체인을 정확히 한 번 탄다 — 게이트웨이가 상태를 정하지 않는다")
    void allowedRequestPassesThroughOnce() {
        rateLimiter.answer(true, limiterHeaders("19"));

        MockServerWebExchange exchange = dispatch(fixedKey(), routeConfig(), SHARED_PLAN_PATH);

        assertThat(forwarded.get()).isEqualTo(1);
        assertThat(exchange.getResponse().getStatusCode()).isNull();
        assertThat(exchange.getResponse().getHeaders().getFirst("X-RateLimit-Remaining")).isEqualTo("19");
        assertThat(appender.list).as("허용은 로그를 남기지 않는다").isEmpty();
    }

    @Test
    @DisplayName("판정은 라우트 id 와 KeyResolver 가 준 키로 묻는다 — 한도가 라우트 id 로 묶여 있다")
    void asksLimiterWithRouteIdAndResolvedKey() {
        rateLimiter.answer(true, limiterHeaders("19"));

        dispatch(fixedKey(), routeConfig(), SHARED_PLAN_PATH);

        assertThat(rateLimiter.calls).containsExactly(ROUTE_ID + " " + KEY);
    }

    @Test
    @DisplayName("Config 에 라우트 id 가 없으면 교환에 실린 라우트에서 읽는다")
    void fallsBackToRouteAttribute() {
        rateLimiter.answer(true, limiterHeaders("19"));
        MockServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get(SHARED_PLAN_PATH));
        exchange.getAttributes().put(ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR, Route.async()
            .id("route-from-exchange").uri("http://localhost").predicate(ignored -> true).build());

        dispatch(fixedKey(), new SharedPlanRateLimitGatewayFilterFactory.Config(), exchange);

        assertThat(rateLimiter.calls).containsExactly("route-from-exchange " + KEY);
    }

    @Test
    @DisplayName("키가 없으면 판정을 묻지 않고 그대로 통과한다 — 헤더도 붙이지 않는다")
    void emptyKeyPassesWithoutAsking() {
        MockServerWebExchange exchange = dispatch(ignored -> Mono.empty(), routeConfig(), SHARED_PLAN_PATH);

        assertThat(rateLimiter.calls).isEmpty();
        assertThat(forwarded.get()).isEqualTo(1);
        assertThat(exchange.getResponse().getStatusCode()).isNull();
        assertThat(exchange.getResponse().getHeaders().getFirst("X-RateLimit-Remaining")).isNull();
    }

    @Test
    @DisplayName("실제 KeyResolver 로 — 토큰 세그먼트가 없는 공유 경로는 판정 없이 통과한다")
    void sharedPlanPathWithoutTokenPassesWithRealResolver() {
        dispatch(realResolver(), routeConfig(), "/api/v1/shared-plans");

        assertThat(rateLimiter.calls).isEmpty();
        assertThat(forwarded.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("리미터가 오류 신호를 내면 통과시키고 WARN 한 줄 — routeId·키 해시만 있고 토큰 원문은 없다")
    void limiterErrorSignalFailsOpen() {
        rateLimiter.respond((routeId, id) -> Mono.error(new IllegalStateException("limiter backend unavailable")));

        MockServerWebExchange exchange = dispatch(realResolver(), routeConfig(), SHARED_PLAN_PATH);

        assertThat(forwarded.get()).isEqualTo(1);
        assertThat(exchange.getResponse().getStatusCode()).isNull();
        assertSingleFailOpenWarning();
    }

    @Test
    @DisplayName("리미터가 동기 예외를 던져도(라우트 한도 미설정 등) 통과시키고 WARN 한 줄이다 — 500 이 되지 않는다")
    void limiterSynchronousExceptionFailsOpen() {
        rateLimiter.respond((routeId, id) -> {
            throw new IllegalArgumentException("No Configuration found for route " + routeId + " or defaultFilters");
        });

        MockServerWebExchange exchange = dispatch(realResolver(), routeConfig(), SHARED_PLAN_PATH);

        assertThat(forwarded.get()).isEqualTo(1);
        assertThat(exchange.getResponse().getStatusCode()).isNull();
        assertSingleFailOpenWarning();
    }

    @Test
    @DisplayName("리미터가 판정을 주지 않고 끝나도(빈 Mono) 요청이 매달리지 않고 통과한다")
    void limiterEmptyDecisionPassesThrough() {
        rateLimiter.respond((routeId, id) -> Mono.empty());

        dispatch(fixedKey(), routeConfig(), SHARED_PLAN_PATH);

        assertThat(forwarded.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("판정은 이벤트 루프가 아닌 스레드에서 구독된다 — 연결 팩토리 락을 이벤트 루프가 기다리지 않는다 (#1253)")
    void limiterDecisionIsSubscribedOffTheEventLoop() {
        AtomicBoolean eventLoopIsNonBlocking = new AtomicBoolean();
        Mono.fromRunnable(() -> eventLoopIsNonBlocking.set(Schedulers.isInNonBlockingThread()))
            .subscribeOn(eventLoop)
            .block(Duration.ofSeconds(5));
        AtomicReference<Thread> askedOn = new AtomicReference<>();
        AtomicReference<Thread> subscribedOn = new AtomicReference<>();
        AtomicBoolean subscribedOnNonBlockingThread = new AtomicBoolean(true);
        RateLimiter.Response allowed = new RateLimiter.Response(true, limiterHeaders("19"));
        rateLimiter.respond((routeId, id) -> {
            askedOn.set(Thread.currentThread());
            // RedisRateLimiter 는 구독될 때 공유 연결을 얻는다(Mono.fromSupplier(factory::getReactiveConnection)). 그 자리를 흉내 낸다.
            return Mono.fromCallable(() -> {
                subscribedOn.set(Thread.currentThread());
                subscribedOnNonBlockingThread.set(Schedulers.isInNonBlockingThread());
                return allowed;
            });
        });

        MockServerWebExchange exchange = dispatchOn(eventLoop, fixedKey(), routeConfig(), SHARED_PLAN_PATH);

        assertThat(eventLoopIsNonBlocking).as("흉내 낸 이벤트 루프는 Reactor 가 블로킹을 금지하는 스레드여야 한다").isTrue();
        assertThat(askedOn.get()).as("판정을 실제로 물었다").isNotNull();
        assertThat(askedOn.get().getName()).doesNotStartWith("fake-event-loop");
        assertThat(subscribedOn.get().getName()).doesNotStartWith("fake-event-loop");
        assertThat(subscribedOnNonBlockingThread).as("연결을 얻는 구독이 블로킹이 허용된 스레드에서 일어난다").isFalse();
        assertThat(forwarded.get()).as("판정 뒤 체인은 정확히 한 번 이어진다").isEqualTo(1);
        assertThat(exchange.getResponse().getHeaders().getFirst("X-RateLimit-Remaining")).isEqualTo("19");
    }

    @Test
    @DisplayName("업스트림 오류는 판정 실패로 삼키지 않는다 — 체인을 두 번 타지 않고 오류가 그대로 올라간다")
    void upstreamErrorIsNotTreatedAsLimiterFailure() {
        rateLimiter.answer(true, limiterHeaders("19"));
        SharedPlanRateLimitGatewayFilterFactory factory = new SharedPlanRateLimitGatewayFilterFactory(rateLimiter, fixedKey(), objectMapper);
        MockServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get(SHARED_PLAN_PATH));

        Mono<Void> filtered = factory.apply(routeConfig())
            .filter(exchange, forwardedExchange -> {
                forwarded.incrementAndGet();
                return Mono.error(new IllegalStateException("upstream failed"));
            });

        assertThatThrownBy(filtered::block).hasMessage("upstream failed");
        assertThat(forwarded.get()).isEqualTo(1);
        assertThat(appender.list).as("업스트림 오류는 리밋의 일이 아니다").isEmpty();
    }

    private void assertSingleFailOpenWarning() {
        assertThat(appender.list).singleElement().satisfies(event -> {
            assertThat(event.getLevel()).isEqualTo(Level.WARN);
            assertThat(event.getFormattedMessage())
                .contains("routeId=" + ROUTE_ID)
                .contains("key=hondigagae:test:shared-plan:")
                .doesNotContain(TOKEN);
        });
    }

    private MockServerWebExchange dispatch(KeyResolver keyResolver, SharedPlanRateLimitGatewayFilterFactory.Config config,
        String path) {
        return dispatch(keyResolver, config, MockServerWebExchange.from(MockServerHttpRequest.get(path)));
    }

    private MockServerWebExchange dispatch(KeyResolver keyResolver, SharedPlanRateLimitGatewayFilterFactory.Config config,
        MockServerWebExchange exchange) {
        return dispatchOn(Schedulers.immediate(), keyResolver, config, exchange);
    }

    /** {@link #dispatch} 와 같되 필터 구독을 {@code scheduler} 위에서 시작한다 — 실제로는 Netty 이벤트 루프 자리다. */
    private MockServerWebExchange dispatchOn(Scheduler scheduler, KeyResolver keyResolver,
        SharedPlanRateLimitGatewayFilterFactory.Config config, String path) {
        return dispatchOn(scheduler, keyResolver, config, MockServerWebExchange.from(MockServerHttpRequest.get(path)));
    }

    private MockServerWebExchange dispatchOn(Scheduler scheduler, KeyResolver keyResolver,
        SharedPlanRateLimitGatewayFilterFactory.Config config, MockServerWebExchange exchange) {
        SharedPlanRateLimitGatewayFilterFactory factory = new SharedPlanRateLimitGatewayFilterFactory(rateLimiter, keyResolver, objectMapper);

        factory.apply(config)
            .filter(exchange, forwardedExchange -> {
                forwarded.incrementAndGet();
                return Mono.empty();
            })
            .subscribeOn(scheduler)
            .block(Duration.ofSeconds(5));

        return exchange;
    }

    private static KeyResolver fixedKey() {
        return ignored -> Mono.just(KEY);
    }

    private static KeyResolver realResolver() {
        return new SharedPlanTokenKeyResolver(new RedisProperties(null, null, null, null, null, null, null, "hondigagae:test", null, null));
    }

    private static SharedPlanRateLimitGatewayFilterFactory.Config routeConfig() {
        SharedPlanRateLimitGatewayFilterFactory.Config config = new SharedPlanRateLimitGatewayFilterFactory.Config();
        config.setRouteId(ROUTE_ID);
        return config;
    }

    /** {@code RedisRateLimiter#getHeaders} 가 붙이는 네 헤더와 같은 모양이다. */
    private static Map<String, String> limiterHeaders(String remaining) {
        return Map.of(
            "X-RateLimit-Remaining", remaining,
            "X-RateLimit-Replenish-Rate", "2",
            "X-RateLimit-Burst-Capacity", "20",
            "X-RateLimit-Requested-Tokens", "1");
    }

    private static String body(MockServerWebExchange exchange) {
        return exchange.getResponse().getBodyAsString().block();
    }

    /** 받은 질문을 적어 두고 정해 둔 방식으로 답하는 가짜. */
    private static final class RecordingRateLimiter extends AbstractRateLimiter<Object> {

        private final List<String> calls = new ArrayList<>();
        private BiFunction<String, String, Mono<RateLimiter.Response>> responder =
            (routeId, id) -> Mono.just(new RateLimiter.Response(true, Map.of()));

        private RecordingRateLimiter() {
            super(Object.class, "recording-rate-limiter", null);
        }

        private void answer(boolean allowed, Map<String, String> headers) {
            RateLimiter.Response response = new RateLimiter.Response(allowed, headers);
            this.responder = (routeId, id) -> Mono.just(response);
        }

        private void respond(BiFunction<String, String, Mono<RateLimiter.Response>> responder) {
            this.responder = responder;
        }

        @Override
        public Mono<RateLimiter.Response> isAllowed(String routeId, String id) {
            calls.add(routeId + " " + id);
            return responder.apply(routeId, id);
        }
    }
}

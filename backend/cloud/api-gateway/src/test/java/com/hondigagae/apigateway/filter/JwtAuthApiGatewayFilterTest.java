package com.hondigagae.apigateway.filter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.apigateway.handler.JwtAuthExceptionWebHandler;
import com.hondigagae.apigateway.jwt.AccessTokenBlacklistChecker;
import com.hondigagae.apigateway.jwt.JwtVerifier;
import com.hondigagae.apigateway.jwt.exception.JwtErrorCode;
import com.hondigagae.apigateway.jwt.exception.JwtException;
import com.hondigagae.apigateway.jwt.properties.JwtVerificationProperties;
import com.hondigagae.redis.properties.RedisProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Scheduler;
import reactor.core.scheduler.Schedulers;

/**
 * 게이트웨이의 토큰 거부가 <b>실제로 나가는 응답</b>까지 검증한다 (#529).
 *
 * <p>필터와 예외 핸들러를 실제 체인과 같은 모양으로 엮는다 —
 * {@code ExceptionHandlingWebHandler} 가 핸들러를 {@code onErrorResume} 으로 거는 그 자리다.
 * 필터만 따로 보면 "예외를 던졌다" 까지밖에 못 말하는데, #529 의 결함은 <b>그 예외가 응답이
 * 될 때</b> 일어났다 — 받는 쪽이 없어 전부 500 이었다.
 *
 * <p>고정하는 것은 다섯이다.
 * <ul>
 *   <li><b>만료</b> — 401 + 봉투. 500 이면 프론트 BFF 가 재발급을 걸지 않아 세션이 스스로 복구되지 않는다
 *   <li><b>형식이 깨진 토큰</b> — 401 + 봉투
 *   <li><b>블랙리스트 조회 불가</b> — 503 + 봉투. 의도한 실패가 진짜 장애와 섞이지 않는다.
 *       Redis 명령 타임아웃도 연결 실패와 같다 (#1253)
 *   <li><b>토큰 없음</b> — 종전대로 통과. <b>이게 깨지면 공개 API 가 전부 막힌다</b>
 *   <li><b>블랙리스트 조회는 이벤트 루프 밖에서 돈다</b> (#1253) — 블로킹 Redis 호출이 Netty 이벤트 루프를
 *       명령 타임아웃만큼 붙잡으면 그 루프에 걸린 다른 요청(공개 API 포함)이 모두 멈춘다
 * </ul>
 */
class JwtAuthApiGatewayFilterTest {

    private static final String ACCESS_SECRET = "hondigagae-gateway-test-access-secret-key-0123456789";
    private static final String OTHER_SECRET = "hondigagae-gateway-test-other-secret-key-9876543210";
    private static final String MEMBER_ID_HEADER = "X-Authenticated-Member-Id";
    private static final String MEMBER_ID = "1234567890123456789";

    private JwtVerifier jwtVerifier;
    private AccessTokenBlacklistChecker blacklistChecker;
    private JwtAuthApiGatewayFilter filter;
    private JwtAuthExceptionWebHandler handler;

    /** 체인까지 도달한 요청. 도달하지 않았으면 null 이다. */
    private AtomicReference<ServerWebExchange> forwarded;

    /** Netty 이벤트 루프 흉내 — Reactor 가 블로킹 금지(NonBlocking)로 표시하는 스레드 하나다. */
    private Scheduler eventLoop;

    @BeforeEach
    void setUp() {
        jwtVerifier = new JwtVerifier(new JwtVerificationProperties(ACCESS_SECRET, false));
        blacklistChecker = mock(AccessTokenBlacklistChecker.class);
        when(blacklistChecker.isBlacklisted(anyString())).thenReturn(false);

        filter = new JwtAuthApiGatewayFilter(jwtVerifier, blacklistChecker);
        handler = new JwtAuthExceptionWebHandler(new ObjectMapper());
        forwarded = new AtomicReference<>();
        eventLoop = Schedulers.newSingle("fake-event-loop");
    }

    @AfterEach
    void tearDown() {
        eventLoop.dispose();
    }

    @Test
    @DisplayName("만료 토큰은 401 + 봉투 + SECURITY_002 다 — 종전에는 500 이라 재발급이 걸리지 않았다")
    void expiredTokenYieldsUnauthorizedEnvelope() {
        MockServerWebExchange exchange = dispatch(bearer(token(ACCESS_SECRET, Duration.ofHours(-26))));

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(exchange.getResponse().getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_JSON);
        assertThat(body(exchange))
            .contains("\"success\":false")
            .contains("\"resultCode\":\"SECURITY_002\"");
        assertThat(forwarded.get()).as("거부된 토큰은 업스트림까지 가지 않는다").isNull();
    }

    @Test
    @DisplayName("형식이 깨진 토큰은 401 + 봉투 + SECURITY_005 다")
    void malformedTokenYieldsUnauthorizedEnvelope() {
        MockServerWebExchange exchange = dispatch("Bearer garbage");

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(body(exchange)).contains("\"resultCode\":\"SECURITY_005\"");
        assertThat(forwarded.get()).isNull();
    }

    @Test
    @DisplayName("서명이 다른 토큰은 401 + 봉투 + SECURITY_004 다 — 시크릿 로테이션이 전면 500 이 되지 않는다")
    void wrongSignatureYieldsUnauthorizedEnvelope() {
        MockServerWebExchange exchange = dispatch(bearer(token(OTHER_SECRET, Duration.ofHours(1))));

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(body(exchange)).contains("\"resultCode\":\"SECURITY_004\"");
        assertThat(forwarded.get()).isNull();
    }

    @Test
    @DisplayName("블랙리스트 조회 불가는 503 + 봉투 + SECURITY_008 이다 — Redis 장애가 500 폭풍이 되지 않는다")
    void blacklistLookupFailureYieldsServiceUnavailableEnvelope() {
        when(blacklistChecker.isBlacklisted(anyString()))
            .thenThrow(new JwtException(JwtErrorCode.TOKEN_VERIFICATION_UNAVAILABLE));

        MockServerWebExchange exchange = dispatch(bearer(token(ACCESS_SECRET, Duration.ofHours(1))));

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(body(exchange)).contains("\"resultCode\":\"SECURITY_008\"");
        assertThat(forwarded.get()).as("확인하지 못한 토큰은 업스트림까지 가지 않는다").isNull();
    }

    static Stream<Arguments> nonRedisFailures() {
        return Stream.of(
            Arguments.of("IllegalStateException", new IllegalStateException("LettuceConnectionFactory has been STOPPED")),
            Arguments.of("RejectedExecutionException", new RejectedExecutionException("boundedElastic task queue is full")));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("nonRedisFailures")
    @DisplayName("판정기가 Redis 장애(DataAccessException)가 아닌 예외를 던지면 통과시키지 않는다 — 기본 오류 처리로 넘어간다")
    void unexpectedLookupFailureDoesNotPassThrough(String name, RuntimeException failure) {
        when(blacklistChecker.isBlacklisted(anyString())).thenThrow(failure);

        assertThatThrownBy(() -> dispatch(bearer(token(ACCESS_SECRET, Duration.ofHours(1)))))
            .as("JwtException 이 아니라 그대로 올라가 부트 기본 핸들러(500)가 받는다")
            .isSameAs(failure);
        assertThat(forwarded.get()).as("확인하지 못한 토큰은 업스트림까지 가지 않는다").isNull();
    }

    @Test
    @DisplayName("fail-open 이어도 Redis 장애가 아닌 예외는 통과시키지 않는다 — fail-open 은 DataAccessException 에만 걸린다")
    void failOpenDoesNotCoverNonRedisFailures() {
        filter = new JwtAuthApiGatewayFilter(jwtVerifier, checkerFailingWith(new IllegalStateException("unexpected"), true));

        assertThatThrownBy(() -> dispatch(bearer(token(ACCESS_SECRET, Duration.ofHours(1)))))
            .isInstanceOf(IllegalStateException.class);
        assertThat(forwarded.get()).isNull();
    }

    @Test
    @DisplayName("Redis 명령 타임아웃도 503 + SECURITY_008 이다 — 연결 실패만 잡던 때는 500 으로 샜다 (#1253)")
    void blacklistCommandTimeoutYieldsServiceUnavailableEnvelope() {
        filter = new JwtAuthApiGatewayFilter(jwtVerifier, checkerFailingWith(commandTimeout(), false));

        MockServerWebExchange exchange = dispatch(bearer(token(ACCESS_SECRET, Duration.ofHours(1))));

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(body(exchange)).contains("\"resultCode\":\"SECURITY_008\"");
        assertThat(forwarded.get()).isNull();
    }

    @Test
    @DisplayName("fail-open 이면 Redis 명령 타임아웃에도 통과한다 — 연결 실패와 같은 규칙이다 (#1253)")
    void blacklistCommandTimeoutPassesThroughWhenFailOpen() {
        filter = new JwtAuthApiGatewayFilter(jwtVerifier, checkerFailingWith(commandTimeout(), true));

        MockServerWebExchange exchange = dispatch(bearer(token(ACCESS_SECRET, Duration.ofHours(1))));

        assertThat(forwarded.get()).isNotNull();
        assertThat(forwarded.get().getRequest().getHeaders().getFirst(MEMBER_ID_HEADER)).isEqualTo(MEMBER_ID);
        assertThat(exchange.getResponse().getStatusCode()).isNull();
    }

    @Test
    @DisplayName("로그아웃된 토큰은 401 + 봉투 + SECURITY_007 이다 — 블랙리스트 확인을 옮겨도 판정은 같다")
    void revokedTokenYieldsUnauthorizedEnvelope() {
        when(blacklistChecker.isBlacklisted(anyString())).thenReturn(true);

        MockServerWebExchange exchange = dispatch(bearer(token(ACCESS_SECRET, Duration.ofHours(1))));

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(body(exchange)).contains("\"resultCode\":\"SECURITY_007\"");
        assertThat(forwarded.get()).isNull();
    }

    @Test
    @DisplayName("블랙리스트 확인은 이벤트 루프가 아닌 스레드에서 돈다 — 블로킹 Redis 호출이 루프를 붙잡지 않는다 (#1253)")
    void blacklistLookupRunsOffTheEventLoop() {
        AtomicBoolean eventLoopIsNonBlocking = new AtomicBoolean();
        Mono.fromRunnable(() -> eventLoopIsNonBlocking.set(Schedulers.isInNonBlockingThread()))
            .subscribeOn(eventLoop)
            .block(Duration.ofSeconds(5));
        AtomicReference<Thread> lookupThread = new AtomicReference<>();
        AtomicBoolean lookupOnNonBlockingThread = new AtomicBoolean(true);
        when(blacklistChecker.isBlacklisted(anyString())).thenAnswer(invocation -> {
            lookupThread.set(Thread.currentThread());
            lookupOnNonBlockingThread.set(Schedulers.isInNonBlockingThread());
            return false;
        });

        dispatchOn(eventLoop, bearer(token(ACCESS_SECRET, Duration.ofHours(1))));

        assertThat(eventLoopIsNonBlocking).as("흉내 낸 이벤트 루프는 Reactor 가 블로킹을 금지하는 스레드여야 한다").isTrue();
        assertThat(lookupThread.get()).as("블랙리스트 확인이 실제로 불렸다").isNotNull();
        assertThat(lookupThread.get().getName()).doesNotStartWith("fake-event-loop");
        assertThat(lookupOnNonBlockingThread).as("블로킹이 허용된 스레드에서 돈다").isFalse();
        assertThat(forwarded.get()).as("판정 뒤 체인은 그대로 이어진다").isNotNull();
        assertThat(forwarded.get().getRequest().getHeaders().getFirst(MEMBER_ID_HEADER)).isEqualTo(MEMBER_ID);
    }

    @Test
    @DisplayName("토큰이 없으면 종전대로 통과한다 — 이게 깨지면 미로그인 공개 API 가 전부 막힌다")
    void requestWithoutTokenPassesThrough() {
        MockServerWebExchange exchange = dispatch(null);

        assertThat(forwarded.get()).as("체인까지 도달해야 한다").isNotNull();
        assertThat(exchange.getResponse().getStatusCode()).as("게이트웨이가 상태를 정하지 않는다").isNull();
        assertThat(forwarded.get().getRequest().getHeaders().getFirst(MEMBER_ID_HEADER))
            .as("인증되지 않은 요청에 회원 헤더를 붙이지 않는다").isNull();
    }

    @Test
    @DisplayName("정상 토큰은 회원 헤더를 달고 통과한다 — 봉투 변환이 정상 경로를 건드리지 않았다")
    void validTokenPassesThroughWithMemberHeader() {
        MockServerWebExchange exchange = dispatch(bearer(token(ACCESS_SECRET, Duration.ofHours(1))));

        assertThat(forwarded.get()).isNotNull();
        assertThat(forwarded.get().getRequest().getHeaders().getFirst(MEMBER_ID_HEADER)).isEqualTo(MEMBER_ID);
        assertThat(exchange.getResponse().getStatusCode()).isNull();
    }

    @ParameterizedTest(name = "스킴 \"{0}\"")
    @ValueSource(strings = {"Bearer ", "bearer ", "BEARER ", "bEaReR "})
    @DisplayName("로그아웃한 토큰은 스킴의 대소문자와 상관없이 401 + SECURITY_007 이다 — 하류는 소문자 스킴도 인증한다 (#1261)")
    void revokedTokenIsRejectedWhateverTheSchemeCase(String scheme) {
        when(blacklistChecker.isBlacklisted(anyString())).thenReturn(true);

        MockServerWebExchange exchange = dispatch(scheme + token(ACCESS_SECRET, Duration.ofHours(1)));

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(body(exchange)).contains("\"resultCode\":\"SECURITY_007\"");
        assertThat(forwarded.get()).as("폐기된 토큰은 업스트림까지 가지 않는다").isNull();
    }

    @Test
    @DisplayName("소문자 스킴의 정상 토큰도 회원 헤더를 달고 통과한다 — 토큰으로 읽혔다는 뜻이다 (#1261)")
    void lowercaseSchemeIsReadAsToken() {
        MockServerWebExchange exchange = dispatch("bearer " + token(ACCESS_SECRET, Duration.ofHours(1)));

        assertThat(forwarded.get()).isNotNull();
        assertThat(forwarded.get().getRequest().getHeaders().getFirst(MEMBER_ID_HEADER)).isEqualTo(MEMBER_ID);
        verify(blacklistChecker).isBlacklisted("token-id");
    }

    /**
     * 하류 resource server 가 토큰을 읽는 규칙 — spring-security-oauth2-resource-server
     * {@code DefaultBearerTokenResolver} 의 정규식을 그대로 옮겼다(6.4.x). 의존성을 올릴 때 저쪽 정규식과 다시 대조한다.
     */
    private static final Pattern DOWNSTREAM_AUTHORIZATION =
        Pattern.compile("^Bearer (?<token>[a-zA-Z0-9-._~+/]+=*)$", Pattern.CASE_INSENSITIVE);

    @ParameterizedTest(name = "\"{0}<토큰>{1}\"")
    @CsvSource(value = {
        "'Bearer ',''", "'bearer ',''", "'BEARER ',''", "'bEaReR ',''", "'Bearer ','=='",
        "'Bearer  ',''", "'Bearer\t',''", "'Bearer',''", "' Bearer ',''", "'Bearer ',' '"
    })
    @DisplayName("하류가 토큰으로 인증하는 Authorization 값이면 게이트웨이도 그 토큰의 폐기를 막는다 — 해석이 어긋나면 #1261 이 다시 생긴다")
    void gatewayBlocksRevokedTokenWheneverDownstreamWouldAuthenticate(String before, String after) {
        when(blacklistChecker.isBlacklisted(anyString())).thenReturn(true);
        String authorization = before + token(ACCESS_SECRET, Duration.ofHours(1)) + after;

        MockServerWebExchange exchange = dispatch(authorization);

        if (DOWNSTREAM_AUTHORIZATION.matcher(authorization).matches()) {
            // 지키는 것은 "막는다" 이지 어느 코드로 막느냐가 아니다 — 끝에 = 패딩이 붙으면 게이트웨이는 서명 검증에서
            // 먼저 거부한다(SECURITY_004). 폐기(SECURITY_007)든 형식 · 서명이든 업스트림에 닿지 않으면 된다.
            assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(forwarded.get()).as("하류가 인증할 값이면 폐기된 토큰이 업스트림까지 가면 안 된다").isNull();
        }
        // 하류가 거부하는 값(공백 두 칸 · 탭 · 앞뒤 공백 등)은 게이트웨이가 넘겨도 하류가 401 이라 안전하다
    }

    /**
     * 필터 → (오류면) 예외 핸들러. {@code ExceptionHandlingWebHandler} 가 거는 것과 같은 결선이다.
     *
     * @param authorization {@code null} 이면 Authorization 헤더 자체를 붙이지 않는다
     */
    private MockServerWebExchange dispatch(String authorization) {
        return dispatchOn(Schedulers.immediate(), authorization);
    }

    /**
     * {@link #dispatch} 와 같되 필터 구독을 {@code scheduler} 위에서 시작한다 — 실제로는 Netty 이벤트 루프 자리다.
     *
     * @param authorization {@code null} 이면 Authorization 헤더 자체를 붙이지 않는다
     */
    private MockServerWebExchange dispatchOn(Scheduler scheduler, String authorization) {
        MockServerHttpRequest.BaseBuilder<?> request = MockServerHttpRequest.get("/api/v1/plans");
        if (authorization != null) {
            request.header(HttpHeaders.AUTHORIZATION, authorization);
        }
        MockServerWebExchange exchange = MockServerWebExchange.from(request.build());

        filter.apply(new JwtAuthApiGatewayFilter.Config())
            .filter(exchange, forwardedExchange -> {
                forwarded.set(forwardedExchange);
                return Mono.empty();
            })
            .subscribeOn(scheduler)
            .onErrorResume(error -> handler.handle(exchange, error))
            .block(Duration.ofSeconds(5));

        return exchange;
    }

    /** Redis 가 먹통일 때 Spring Data Redis 가 실제로 내는 명령 타임아웃 예외다 (redis-core RedisCommandTimeoutBehaviorTest). */
    private static QueryTimeoutException commandTimeout() {
        return new QueryTimeoutException("Redis command timed out");
    }

    /** {@code RedisTemplate} 이 {@code failure} 를 던지는 진짜 판정기. */
    private static AccessTokenBlacklistChecker checkerFailingWith(RuntimeException failure, boolean failOpen) {
        RedisTemplate<String, Object> redisTemplate = mock();
        when(redisTemplate.hasKey(anyString())).thenThrow(failure);
        RedisProperties redisProperties = new RedisProperties(null, null, null, null, null, null, null, "hondigagae:test", null, null);
        return new AccessTokenBlacklistChecker(redisTemplate, new JwtVerificationProperties(ACCESS_SECRET, failOpen), redisProperties);
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    /** @param untilExpiry 음수면 이미 만료된 토큰이다 */
    private static String token(String secret, Duration untilExpiry) {
        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(MEMBER_ID)
            .id("token-id")
            .issuedAt(Date.from(now.minus(Duration.ofHours(27))))
            .expiration(Date.from(now.plus(untilExpiry)))
            .signWith(key)
            .compact();
    }

    private static String body(MockServerWebExchange exchange) {
        return exchange.getResponse().getBodyAsString().block();
    }
}

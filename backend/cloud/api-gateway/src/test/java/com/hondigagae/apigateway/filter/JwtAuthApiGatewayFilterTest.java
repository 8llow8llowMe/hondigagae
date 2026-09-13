package com.hondigagae.apigateway.filter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.apigateway.handler.JwtAuthExceptionWebHandler;
import com.hondigagae.apigateway.jwt.AccessTokenBlacklistChecker;
import com.hondigagae.apigateway.jwt.JwtVerifier;
import com.hondigagae.apigateway.jwt.exception.JwtErrorCode;
import com.hondigagae.apigateway.jwt.exception.JwtException;
import com.hondigagae.apigateway.jwt.properties.JwtVerificationProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.concurrent.atomic.AtomicReference;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * 게이트웨이의 토큰 거부가 <b>실제로 나가는 응답</b>까지 검증한다 (#529).
 *
 * <p>필터와 예외 핸들러를 실제 체인과 같은 모양으로 엮는다 —
 * {@code ExceptionHandlingWebHandler} 가 핸들러를 {@code onErrorResume} 으로 거는 그 자리다.
 * 필터만 따로 보면 "예외를 던졌다" 까지밖에 못 말하는데, #529 의 결함은 <b>그 예외가 응답이
 * 될 때</b> 일어났다 — 받는 쪽이 없어 전부 500 이었다.
 *
 * <p>고정하는 것은 넷이다.
 * <ul>
 *   <li><b>만료</b> — 401 + 봉투. 500 이면 프론트 BFF 가 재발급을 걸지 않아 세션이 스스로 복구되지 않는다
 *   <li><b>형식이 깨진 토큰</b> — 401 + 봉투
 *   <li><b>블랙리스트 조회 불가</b> — 503 + 봉투. 의도한 실패가 진짜 장애와 섞이지 않는다
 *   <li><b>토큰 없음</b> — 종전대로 통과. <b>이게 깨지면 공개 API 가 전부 막힌다</b>
 * </ul>
 */
class JwtAuthApiGatewayFilterTest {

    private static final String ACCESS_SECRET = "hondigagae-gateway-test-access-secret-key-0123456789";
    private static final String OTHER_SECRET = "hondigagae-gateway-test-other-secret-key-9876543210";
    private static final String MEMBER_ID_HEADER = "X-Authenticated-Member-Id";
    private static final String MEMBER_ID = "1234567890123456789";

    private AccessTokenBlacklistChecker blacklistChecker;
    private JwtAuthApiGatewayFilter filter;
    private JwtAuthExceptionWebHandler handler;

    /** 체인까지 도달한 요청. 도달하지 않았으면 null 이다. */
    private AtomicReference<ServerWebExchange> forwarded;

    @BeforeEach
    void setUp() {
        JwtVerifier jwtVerifier = new JwtVerifier(new JwtVerificationProperties(ACCESS_SECRET, false));
        blacklistChecker = mock(AccessTokenBlacklistChecker.class);
        when(blacklistChecker.isBlacklisted(anyString())).thenReturn(false);

        filter = new JwtAuthApiGatewayFilter(jwtVerifier, blacklistChecker);
        handler = new JwtAuthExceptionWebHandler(new ObjectMapper());
        forwarded = new AtomicReference<>();
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

    /**
     * 필터 → (오류면) 예외 핸들러. {@code ExceptionHandlingWebHandler} 가 거는 것과 같은 결선이다.
     *
     * @param authorization {@code null} 이면 Authorization 헤더 자체를 붙이지 않는다
     */
    private MockServerWebExchange dispatch(String authorization) {
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
            .onErrorResume(error -> handler.handle(exchange, error))
            .block();

        return exchange;
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

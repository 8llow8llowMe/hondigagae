package com.hondigagae.apigateway.filter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.apigateway.exception.GatewayErrorCode;
import com.hondigagae.common.dto.Response;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RateLimiter;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.support.HasRouteId;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * 공유 링크 공개 라우트 전용 레이트 리밋. 거부를 <b>공통 응답 봉투</b>({@code GATEWAY_001}, 429)로 낸다 (#1244).
 * yml 에서는 {@code SharedPlanRateLimit} 이라는 이름으로 건다.
 *
 * <h2>공유 링크 전용이다 — 다른 라우트에 걸지 않는다</h2>
 *
 * <p>키는 공유 토큰 전용 {@code SharedPlanTokenKeyResolver} 가 정한다. 다른 라우트에 걸면 경로에 공유 토큰 세그먼트가
 * 없어 키가 나오지 않고, <b>판정 없이 그대로 통과한다</b> — 걸었다고 믿는 동안 아무것도 막지 않는다. 다른 라우트에
 * 리밋이 필요하면 그 라우트의 키 규칙을 가진 별도 리졸버·팩토리를 만든다. 이름을 용도로 좁힌 것이 그 때문이다.
 *
 * <p>SCG 의 기본 {@code RequestRateLimiterGatewayFilterFactory} 도 자동구성으로 이 리졸버를 받아 등록되지만 쓰지
 * 않는다 — 거부를 <b>빈 본문</b>의 429 로 끝내 봉투 계약(api-design-guide §2-2)을 깬다. {@code RateLimitRouteCoverageTest}
 * 가 세 프로파일 yml 에서 그 사용을 막는다.
 *
 * <h2>이 클래스가 정하는 것</h2>
 *
 * <p>토큰 버킷 판정, 라우트별 한도 바인딩, Redis 장애 시 통과(fail-open + 요청마다 ERROR 로그)는 자동구성된
 * {@code RedisRateLimiter} 의 몫이다. 한도는 yml {@code args} 에 {@code redis-rate-limiter.replenishRate} 처럼 적고,
 * 이 필터의 {@link Config} 가 아니라 {@code RedisRateLimiter} 가 {@code FilterArgsEvent} 로 받아 라우트 id 에 묶는다.
 * 여기서 정하는 것은 아래 셋이다.
 *
 * <ul>
 *   <li><b>키가 없으면 판정 없이 통과</b> — 기본 필터의 deny-empty-key(403)와 반대다. 토큰 세그먼트가 없는 요청은
 *       plan-service 가 싸게 4xx 로 끝내고 증폭이 없다. 막을 이유가 없고, 403 은 봉투 밖으로 나간다</li>
 *   <li><b>판정 자체가 실패하면 통과</b> — 리미터가 오류를 내거나(라우트 한도 미설정 등) 판정을 주지 않으면
 *       {@code RedisRateLimiter} 의 fail-open 과 같은 쪽으로 통과시키고 WARN 한 줄을 남긴다. 리밋의 고장이 공유 화면
 *       전체의 500 이 되지 않는다</li>
 *   <li><b>거부 응답의 모양</b> — 429 + JSON 봉투. 판정이 준 {@code X-RateLimit-*} 헤더는 허용·거부 양쪽에 싣는다</li>
 * </ul>
 *
 * <p>거부는 DEBUG 로만 남긴다. 거부가 쏟아지는 것이 이 기능이 상정한 상황이라 요청마다 WARN 을 쓰면 로그가 같이
 * 폭주한다 — 요청 단위 기록은 {@code LoggingGlobalApiGatewayFilter} 의 429 한 줄로 충분하고, 알림은 메트릭
 * ({@code spring_cloud_gateway_requests_seconds_count{routeId="plan-service-shared-plans",httpStatusCode="429"}})으로 건다.
 */
@Slf4j
@Component
public class SharedPlanRateLimitGatewayFilterFactory
    extends AbstractGatewayFilterFactory<SharedPlanRateLimitGatewayFilterFactory.Config> {

    private final RateLimiter<?> rateLimiter;
    private final KeyResolver keyResolver;

    /** 거부 봉투는 요청마다 같다. 기동 때 한 번 직렬화한다 — 실패하면 요청 시점이 아니라 기동 시점에 드러난다. */
    private final byte[] rateLimitedBody;

    public SharedPlanRateLimitGatewayFilterFactory(RateLimiter<?> rateLimiter, KeyResolver keyResolver, ObjectMapper objectMapper) {
        super(Config.class);
        this.rateLimiter = rateLimiter;
        this.keyResolver = keyResolver;
        this.rateLimitedBody = serializeEnvelope(objectMapper, GatewayErrorCode.RATE_LIMITED);
    }

    @Override
    public GatewayFilter apply(Config config) {
        // 빈 Mono 를 "키 없음" 으로 읽되, 통과한 체인(Mono<Void>, 역시 비어 끝난다)과 섞이지 않게 Optional 로 감싼다.
        // switchIfEmpty 로 쓰면 허용된 요청이 체인을 두 번 탄다.
        return (exchange, chain) -> keyResolver.resolve(exchange)
            .map(Optional::of)
            .defaultIfEmpty(Optional.empty())
            .flatMap(key -> key.isPresent()
                ? limit(exchange, chain, routeIdOf(config, exchange), key.get())
                : chain.filter(exchange));
    }

    private Mono<Void> limit(ServerWebExchange exchange, GatewayFilterChain chain, String routeId, String key) {
        return decide(routeId, key).flatMap(decision -> {
            if (decision.isEmpty()) {
                return chain.filter(exchange);
            }
            exchange.getResponse().getHeaders().setAll(decision.get().getHeaders());
            if (decision.get().isAllowed()) {
                return chain.filter(exchange);
            }
            // 키는 해시라 남겨도 된다. 경로는 남기지 않는다 — 토큰 원문이 들어 있다 (LoggingGlobalApiGatewayFilter 가 가린다).
            log.debug("[SharedPlanRateLimitGatewayFilterFactory] 요청 한도 초과: routeId={} key={}", routeId, key);
            return writeRateLimited(exchange.getResponse());
        });
    }

    /**
     * 리미터에 묻는다. 판정 자체가 실패하면(오류 신호·동기 예외·빈 응답) <b>empty</b> 다 — 호출부가 통과시킨다.
     *
     * <p>{@code onErrorResume} 을 체인 앞에서 끊는다. 뒤에 두면 업스트림(plan-service) 오류까지 "판정 실패" 로 삼켜
     * 체인을 한 번 더 태운다.
     *
     * <p><b>판정은 {@code boundedElastic} 에서 구독한다 (#1253).</b> {@code RedisRateLimiter} 는 구독될 때 Redis 공유
     * 리액티브 연결을 얻는데, {@code LettuceConnectionFactory} 는 동기·리액티브 공유 연결을 <b>팩토리 락 하나</b> 아래에서
     * 처음 맺는다(동기 connect). Redis 가 처음부터 먹통인 채 기동하면 블랙리스트 확인({@code boundedElastic})들이 그 락을
     * 잡고 연결 타임아웃씩 줄을 서는데, 여기서 이벤트 루프가 구독하면 <b>이벤트 루프가 같은 락을 기다려</b> 그 루프의
     * 다른 요청까지 멈춘다. 구독 스레드만 옮기므로 판정 결과 · fail-open · 체인 1회 · 오류 처리는 그대로다 — 응답은
     * Lettuce 의 I/O 스레드에서 오고, 체인은 종전처럼 판정이 끝난 스레드에서 이어진다.
     */
    private Mono<Optional<RateLimiter.Response>> decide(String routeId, String key) {
        return Mono.defer(() -> rateLimiter.isAllowed(routeId, key))
            .subscribeOn(Schedulers.boundedElastic())
            .map(Optional::of)
            .onErrorResume(error -> {
                log.warn("[SharedPlanRateLimitGatewayFilterFactory] 판정 실패, 통과시킨다: routeId={} key={} error={}",
                    routeId, key, error.toString());
                return Mono.just(Optional.empty());
            })
            .defaultIfEmpty(Optional.empty());
    }

    private Mono<Void> writeRateLimited(ServerHttpResponse response) {
        response.setStatusCode(GatewayErrorCode.RATE_LIMITED.getHttpStatus());
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        return response.writeWith(Mono.fromSupplier(() -> response.bufferFactory().wrap(rateLimitedBody)));
    }

    /** 한도가 라우트 id 로 묶여 있다. yml 로 건 필터는 {@link HasRouteId} 로 받고, 아니면 교환에 실린 라우트에서 읽는다. */
    private static String routeIdOf(Config config, ServerWebExchange exchange) {
        if (config.getRouteId() != null) {
            return config.getRouteId();
        }
        Route route = exchange.getAttribute(ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR);
        if (route == null) {
            throw new IllegalStateException("SharedPlanRateLimit 필터는 라우트에 걸어야 합니다 — 한도가 라우트 id 로 묶입니다.");
        }
        return route.getId();
    }

    private static byte[] serializeEnvelope(ObjectMapper objectMapper, GatewayErrorCode errorCode) {
        try {
            return objectMapper.writeValueAsBytes(Response.fail(errorCode.getCode(), errorCode.getMessage()));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("레이트 리밋 거부 봉투를 직렬화할 수 없습니다: errorCode=" + errorCode.name(), e);
        }
    }

    /** 라우트 id 만 받는다. 한도 인자({@code redis-rate-limiter.*})는 {@code RedisRateLimiter} 가 따로 받는다. */
    public static class Config implements HasRouteId {

        private String routeId;

        @Override
        public void setRouteId(String routeId) {
            this.routeId = routeId;
        }

        @Override
        public String getRouteId() {
            return routeId;
        }
    }
}

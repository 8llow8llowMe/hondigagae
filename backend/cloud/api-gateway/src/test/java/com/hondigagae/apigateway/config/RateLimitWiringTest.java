package com.hondigagae.apigateway.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.apigateway.filter.SharedPlanRateLimitGatewayFilterFactory;
import com.hondigagae.apigateway.ratelimit.SharedPlanTokenKeyResolver;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.cloud.gateway.filter.factory.GatewayFilterFactory;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RateLimiter;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.context.ApplicationContext;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;

/**
 * 레이트 리밋이 <b>실제 게이트웨이 컨텍스트에서</b> 배선되는지 고정한다 (#1244).
 *
 * <p>단위 테스트는 "필터를 부르면 429 봉투가 나온다" 까지만 말한다. 이 기능은 그 앞에서 조용히 사라질 수 있다 —
 * <b>{@code RedisRateLimiter} 는 자동구성인데, 그 조건이 이 저장소에서는 저절로 서지 않는다.</b>
 * redis-core 의 연결 팩토리 선언 반환형이 {@code RedisConnectionFactory} 라 부트의 리액티브 Redis 자동구성이 꺼지고,
 * 그러면 SCG 의 {@code GatewayRedisAutoConfiguration}({@code @ConditionalOnBean(ReactiveRedisTemplate)})도 꺼진다
 * ({@link ApiGatewayRateLimitConfig}). 빈이 없으면 yml 의 {@code SharedPlanRateLimit} 이 기동을 깨거나, 한도가 라우트에
 * 묶이지 않아 첫 요청에서 터진다.
 *
 * <p>외부 의존 없이 뜬다 — Eureka·Config 를 끄고, Redis 는 Lettuce 가 첫 명령 때 연결하므로 기동에 필요 없다.
 * 웹 환경은 기본값(MOCK)이다. 게이트웨이는 리액티브라 서버 없이 리액티브 웹 컨텍스트가 뜬다.
 */
@SpringBootTest(webEnvironment = WebEnvironment.MOCK, properties = {
    "eureka.client.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "spring.cloud.config.enabled=false"
})
class RateLimitWiringTest {

    private static final String SHARED_PLAN_ROUTE = "plan-service-shared-plans";

    @Autowired
    private ApplicationContext context;

    @Autowired
    private RouteLocator routeLocator;

    @Test
    @DisplayName("RedisRateLimiter 가 자동구성되고 RateLimiter 는 그것 하나다")
    void redisRateLimiterIsAutoConfigured() {
        assertThat(context.getBeansOfType(RateLimiter.class).values())
            .singleElement()
            .isInstanceOf(RedisRateLimiter.class);
    }

    @Test
    @DisplayName("리액티브 템플릿은 게이트웨이 설정의 것 하나다 — 부트의 리액티브 Redis 자동구성은 꺼져 있다(배선 전제)")
    void reactiveTemplateComesFromGatewayConfig() {
        assertThat(context.getBeansOfType(ReactiveStringRedisTemplate.class)).containsOnlyKeys("reactiveStringRedisTemplate");
        assertThat(context.containsBean("reactiveRedisTemplate"))
            .as("부트 RedisReactiveAutoConfiguration 이 켜졌다면 이 빈이 있다. 켜졌다면 ApiGatewayRateLimitConfig 의 전제를 다시 본다")
            .isFalse();
    }

    @Test
    @DisplayName("KeyResolver 는 공유 토큰 해시 키 하나다 — SCG 기본(principalName)이 서지 않는다")
    void keyResolverIsSharedPlanToken() {
        Map<String, KeyResolver> resolvers = context.getBeansOfType(KeyResolver.class);

        assertThat(resolvers.values()).singleElement().isInstanceOf(SharedPlanTokenKeyResolver.class);
    }

    @Test
    @DisplayName("공유 링크 리밋 필터 팩토리가 게이트웨이에 'SharedPlanRateLimit' 이름으로 등록된다")
    void rateLimitFilterFactoryIsRegistered() {
        assertThat(context.getBeansOfType(GatewayFilterFactory.class).values())
            .filteredOn(SharedPlanRateLimitGatewayFilterFactory.class::isInstance)
            .singleElement()
            .extracting(GatewayFilterFactory::name)
            .isEqualTo("SharedPlanRateLimit");
    }

    @Test
    @DisplayName("한도는 공유 링크 라우트에만 replenishRate 2 · burstCapacity 20 · requestedTokens 1 로 묶인다")
    void sharedPlanRouteLimitIsBound() {
        // 라우트를 실제로 만들어야 FilterArgsEvent 가 나가 RedisRateLimiter 가 라우트별 한도를 받는다.
        assertThat(routeLocator.getRoutes().map(Route::getId).collectList().block()).contains(SHARED_PLAN_ROUTE);

        RedisRateLimiter rateLimiter = context.getBean(RedisRateLimiter.class);
        assertThat(rateLimiter.getConfig()).containsOnlyKeys(SHARED_PLAN_ROUTE);

        RedisRateLimiter.Config limit = rateLimiter.getConfig().get(SHARED_PLAN_ROUTE);
        assertThat(limit.getReplenishRate()).isEqualTo(2);
        assertThat(limit.getBurstCapacity()).isEqualTo(20);
        assertThat(limit.getRequestedTokens()).isEqualTo(1);
    }
}

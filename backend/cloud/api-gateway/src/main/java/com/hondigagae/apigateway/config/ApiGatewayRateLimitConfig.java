package com.hondigagae.apigateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;

/**
 * 게이트웨이 레이트 리밋의 배선 (#1244).
 *
 * <h2>왜 리액티브 템플릿을 여기서 직접 올리나 — 자동구성이 저절로 서지 않는다</h2>
 *
 * <p>판정은 SCG 의 {@code RedisRateLimiter} 가 한다. 그 빈을 만드는 {@code GatewayRedisAutoConfiguration} 은
 * {@code @ConditionalOnBean(ReactiveRedisTemplate)} 이고, 평소 그 템플릿은 부트의 {@code RedisReactiveAutoConfiguration}
 * ({@code @ConditionalOnBean(ReactiveRedisConnectionFactory)})이 만든다. 그런데 redis-core 의
 * {@code RedisConfigurer#redisConnectionFactory} 는 <b>선언 반환형이 {@code RedisConnectionFactory}</b> 다. 실제 객체
 * ({@code LettuceConnectionFactory})는 리액티브 팩토리이기도 하지만, 조건 평가는 빈을 만들기 전에 선언 반환형으로
 * 타입을 예측하므로 맞지 않는다. 그래서 부트 쪽이 꺼지고 → SCG 쪽도 꺼지고 → {@code RedisRateLimiter} 가 없다.
 * 이 클래스는 사용자 설정이라 자동구성보다 먼저 등록되고, 여기서 템플릿을 올리면 SCG 쪽 조건이 선다.
 * {@code RateLimitWiringTest} 가 실제 컨텍스트로 이 배선을 고정한다.
 *
 * <p><b>redis-core 의 반환형을 넓히지 않은 이유</b> — 그 모듈은 서블릿 서비스(auth·tour·ai)도 함께 쓴다. 넓히면
 * 그 서비스들에서도 리액티브 템플릿·리액티브 헬스 체크가 새로 켜진다. 게이트웨이 하나의 필요로 공용 모듈의
 * 자동구성 표면을 바꾸지 않는다.
 *
 * <p>빈 이름이 부트의 것과 같은 {@code reactiveStringRedisTemplate} 이다. 부트 쪽은
 * {@code @ConditionalOnMissingBean(name = "reactiveStringRedisTemplate")} 라, 언젠가 core 의 반환형이 바뀌어
 * 부트 자동구성이 켜져도 두 빈이 겹치지 않고 이쪽이 남는다.
 *
 * <h2>함께 켜지는 빈 하나가 생성 순서에 기댄다</h2>
 *
 * <p>{@code GatewayRedisAutoConfiguration} 이 켜지면 {@code RedisRateLimiter} 와 함께
 * {@code reactiveRedisRouteDefinitionTemplate(ReactiveRedisConnectionFactory)} 를 <b>조건 없이</b> 만든다(쓰지 않는 빈이다).
 * 그 주입은 타입으로 찾는데, core 연결 팩토리의 선언 반환형은 {@code RedisConnectionFactory} 라 <b>아직 만들어지지 않은</b>
 * 빈이면 리액티브 팩토리로 예측되지 않는다. 지금 풀리는 것은 사용자 설정에서 온 core 연결 팩토리 싱글턴이 그보다 먼저
 * 만들어져 있어 실제 객체({@code LettuceConnectionFactory})로 대조되기 때문이다. 순서가 바뀌면 기동이 실패한다 —
 * {@code RateLimitWiringTest} 의 컨텍스트 로딩이 그것을 잡는다.
 */
@Configuration
public class ApiGatewayRateLimitConfig {

    @Bean
    public ReactiveStringRedisTemplate reactiveStringRedisTemplate(RedisConnectionFactory redisConnectionFactory) {
        if (!(redisConnectionFactory instanceof ReactiveRedisConnectionFactory reactiveRedisConnectionFactory)) {
            throw new IllegalStateException(
                "게이트웨이 레이트 리밋은 리액티브 Redis 연결이 필요합니다. redis-core 의 연결 팩토리가 "
                    + "ReactiveRedisConnectionFactory 가 아닙니다: " + redisConnectionFactory.getClass().getName());
        }
        return new ReactiveStringRedisTemplate(reactiveRedisConnectionFactory);
    }
}

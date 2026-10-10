package com.hondigagae.redis.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.redis.properties.RedisProperties;
import com.hondigagae.redis.properties.enums.RedisMode;
import io.lettuce.core.RedisCommandTimeoutException;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * 명령 타임아웃이 <b>실제 호출에서</b> 무엇으로, 언제 끝나는지 고정한다 (#1253).
 *
 * <p>설정값이 팩토리에 들어갔다는 것({@link RedisConfigurerClientTimeoutTest})만으로는 호출부가 무엇을 잡아야
 * 하는지 말하지 못한다. 게이트웨이의 블랙리스트 확인이 잡는 예외 타입이 여기서 정해진다 —
 * Lettuce 의 {@link RedisCommandTimeoutException} 을 Spring Data Redis 가 {@link QueryTimeoutException} 으로 번역한다.
 * {@code RedisConnectionFailureException} 과 계층이 다르므로 그것만 잡던 코드는 이 예외를 놓친다.
 */
class RedisCommandTimeoutBehaviorTest {

    private static final Duration COMMAND_TIMEOUT = Duration.ofMillis(300);
    /** 명령 타임아웃이 걸리지 않았다면 Lettuce 기본(60초)까지 기다린다. 그보다 한참 짧으면 충분하다. */
    private static final Duration UPPER_BOUND = Duration.ofSeconds(5);

    private UnresponsiveRedisServer server;
    private LettuceConnectionFactory factory;

    @BeforeEach
    void setUp() throws Exception {
        server = new UnresponsiveRedisServer();
        RedisProperties properties = new RedisProperties(RedisMode.STANDALONE, server.host(), server.port(),
            null, null, null, null, null, COMMAND_TIMEOUT, Duration.ofSeconds(1));
        factory = (LettuceConnectionFactory) new RedisConfigurer().redisConnectionFactory(properties);
        factory.afterPropertiesSet();
    }

    @AfterEach
    void tearDown() throws Exception {
        factory.destroy();
        server.close();
    }

    @Test
    @DisplayName("동기 호출은 명령 타임아웃에 QueryTimeoutException 으로 끝난다 — RedisConnectionFailureException 이 아니다")
    void blockingCallEndsWithQueryTimeout() {
        StringRedisTemplate template = new StringRedisTemplate(factory);
        long startedAt = System.nanoTime();

        assertThatThrownBy(() -> template.hasKey("hondigagae:test:blacklist:token-id"))
            .isInstanceOf(QueryTimeoutException.class)
            .hasRootCauseInstanceOf(RedisCommandTimeoutException.class);
        assertThat(Duration.ofNanos(System.nanoTime() - startedAt)).isLessThan(UPPER_BOUND);
    }

    @Test
    @DisplayName("리액티브 명령도 같은 시간에 끝난다 — Lettuce 기본이면 상한이 없어 레이트 리밋 fail-open 이 일어나지 않는다")
    void reactiveCommandEndsWithQueryTimeout() {
        ReactiveStringRedisTemplate template = new ReactiveStringRedisTemplate(factory);
        long startedAt = System.nanoTime();

        assertThatThrownBy(() -> template.hasKey("hondigagae:test:rate-limit").block(UPPER_BOUND))
            .as("명령 타임아웃이 없으면 block 의 상한(IllegalStateException)에 걸린다")
            .isInstanceOf(QueryTimeoutException.class)
            .hasRootCauseInstanceOf(RedisCommandTimeoutException.class);
        assertThat(Duration.ofNanos(System.nanoTime() - startedAt)).isLessThan(UPPER_BOUND);
    }
}

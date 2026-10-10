package com.hondigagae.redis.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.redis.properties.RedisProperties;
import com.hondigagae.redis.properties.enums.RedisMode;
import io.lettuce.core.ClientOptions;
import io.lettuce.core.RedisURI;
import io.lettuce.core.SocketOptions;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.redis.connection.RedisSentinelConfiguration;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;

/**
 * Redis 명령·연결 타임아웃을 설정으로 받는 것을 고정한다 (#1253).
 *
 * <p>고정하는 것은 셋이다.
 * <ul>
 *   <li><b>둘 다 비우면 예전 팩토리 그대로다</b> — 클라이언트 설정 없이 만든다. redis-core 를 쓰는 서비스는
 *       넷(auth · tour · ai · api-gateway)인데 값을 적은 곳은 게이트웨이뿐이라, 나머지 셋은 이 변경으로 바뀌는 게 없어야 한다
 *   <li><b>적으면 standalone · sentinel 둘 다에 걸린다</b> — dev/prod 가 언젠가 sentinel 로 바뀌어도 값이 조용히 빠지지 않는다
 *   <li><b>명령 타임아웃이 리액티브 명령에도 걸린다</b> — Lettuce 기본({@code TimeoutOptions} 꺼짐)으로는
 *       동기 호출만 Spring Data Redis 가 60초에서 끊고, 리액티브 명령(게이트웨이 레이트 리밋)은 상한이 없다
 * </ul>
 */
class RedisConfigurerClientTimeoutTest {

    private static final String HOST = "127.0.0.1";
    private static final int PORT = 6379;

    private final RedisConfigurer configurer = new RedisConfigurer();

    @Nested
    @DisplayName("둘 다 비우면")
    class WhenUnset {

        @ParameterizedTest(name = "{0}")
        @EnumSource(RedisMode.class)
        @DisplayName("클라이언트 설정 없이 만든 팩토리와 같은 설정을 쓴다 — 다른 서비스에 영향이 없다")
        void keepsTheFactoryBuiltWithoutClientConfiguration(RedisMode mode) {
            LettuceClientConfiguration actual = factory(properties(mode, null, null)).getClientConfiguration();
            LettuceClientConfiguration untouched = factoryWithoutClientConfiguration(mode).getClientConfiguration();

            assertThat(actual.getClass()).as("예전 팩토리와 같은 클라이언트 설정 타입").isEqualTo(untouched.getClass());
            assertThat(actual.getCommandTimeout()).as("Lettuce 기본 명령 타임아웃").isEqualTo(RedisURI.DEFAULT_TIMEOUT_DURATION);
            assertThat(actual.getShutdownTimeout()).isEqualTo(untouched.getShutdownTimeout());
            assertThat(actual.getShutdownQuietPeriod()).isEqualTo(untouched.getShutdownQuietPeriod());
            assertThat(actual.getClientOptions()).as("ClientOptions 를 넘기지 않아 Lettuce 기본을 쓴다").isEmpty();
        }

        @Test
        @DisplayName("Lettuce 기본은 명령 타임아웃 감시가 꺼져 있고 연결 타임아웃이 10초다 — 문서에 적은 전제")
        void lettuceDefaultsAreWhatTheDocsSay() {
            ClientOptions lettuceDefaults = ClientOptions.create();

            assertThat(lettuceDefaults.getTimeoutOptions().isTimeoutCommands())
                .as("꺼져 있으면 리액티브·비동기 명령에는 타임아웃이 없다").isFalse();
            assertThat(lettuceDefaults.getSocketOptions().getConnectTimeout()).isEqualTo(Duration.ofSeconds(10));
            assertThat(lettuceDefaults.getDisconnectedBehavior())
                .as("끊긴 동안 명령을 쌓아 두는 기본을 바꾸지 않는다").isEqualTo(ClientOptions.DisconnectedBehavior.DEFAULT);
        }
    }

    @Nested
    @DisplayName("적으면")
    class WhenConfigured {

        @ParameterizedTest(name = "{0}")
        @EnumSource(RedisMode.class)
        @DisplayName("명령 타임아웃과 연결 타임아웃이 standalone · sentinel 모두에 걸린다")
        void appliesBothTimeouts(RedisMode mode) {
            LettuceClientConfiguration configuration =
                factory(properties(mode, Duration.ofSeconds(1), Duration.ofSeconds(2))).getClientConfiguration();

            assertThat(configuration.getCommandTimeout()).isEqualTo(Duration.ofSeconds(1));
            ClientOptions clientOptions = configuration.getClientOptions().orElseThrow();
            assertThat(clientOptions.getSocketOptions().getConnectTimeout()).isEqualTo(Duration.ofSeconds(2));
        }

        @ParameterizedTest(name = "{0}")
        @EnumSource(RedisMode.class)
        @DisplayName("명령 타임아웃 감시를 켠다 — 리액티브 명령도 같은 시간에 끝난다")
        void enablesCommandTimeoutsForEveryApi(RedisMode mode) {
            ClientOptions clientOptions = factory(properties(mode, Duration.ofSeconds(1), Duration.ofSeconds(2)))
                .getClientConfiguration().getClientOptions().orElseThrow();

            assertThat(clientOptions.getTimeoutOptions().isTimeoutCommands()).isTrue();
            assertThat(clientOptions.getTimeoutOptions().isApplyConnectionTimeout())
                .as("감시 시간은 따로 두지 않고 명령 타임아웃을 그대로 쓴다").isTrue();
        }

        @Test
        @DisplayName("연결 타임아웃을 적어도 끊긴 동안 명령을 쌓아 두는 Lettuce 기본은 그대로다")
        void keepsDisconnectedBehavior() {
            ClientOptions clientOptions = factory(properties(RedisMode.STANDALONE, Duration.ofSeconds(1), Duration.ofSeconds(2)))
                .getClientConfiguration().getClientOptions().orElseThrow();

            assertThat(clientOptions.getDisconnectedBehavior()).isEqualTo(ClientOptions.DisconnectedBehavior.DEFAULT);
            assertThat(clientOptions.isAutoReconnect()).isTrue();
        }

        @Test
        @DisplayName("명령 타임아웃만 적으면 연결 타임아웃은 Lettuce 기본(10초)이다")
        void commandTimeoutOnly() {
            LettuceClientConfiguration configuration =
                factory(properties(RedisMode.STANDALONE, Duration.ofMillis(500), null)).getClientConfiguration();

            assertThat(configuration.getCommandTimeout()).isEqualTo(Duration.ofMillis(500));
            assertThat(configuration.getClientOptions().orElseThrow().getSocketOptions().getConnectTimeout())
                .isEqualTo(SocketOptions.DEFAULT_CONNECT_TIMEOUT_DURATION);
        }

        @Test
        @DisplayName("연결 타임아웃만 적으면 명령 타임아웃은 Lettuce 기본(60초)이다")
        void connectTimeoutOnly() {
            LettuceClientConfiguration configuration =
                factory(properties(RedisMode.STANDALONE, null, Duration.ofSeconds(3))).getClientConfiguration();

            assertThat(configuration.getCommandTimeout()).isEqualTo(RedisURI.DEFAULT_TIMEOUT_DURATION);
            assertThat(configuration.getClientOptions().orElseThrow().getSocketOptions().getConnectTimeout())
                .isEqualTo(Duration.ofSeconds(3));
        }

        @ParameterizedTest(name = "{0}")
        @ValueSource(strings = {"PT0S", "PT-1S"})
        @DisplayName("0 이하는 기동 시점에 실패한다 — 0 이면 동기 호출이 상한 없이 기다린다")
        void rejectsNonPositiveTimeouts(String value) {
            Duration invalid = Duration.parse(value);

            assertThatThrownBy(() -> factory(properties(RedisMode.STANDALONE, invalid, null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("infra.redis.command-timeout");
            assertThatThrownBy(() -> factory(properties(RedisMode.STANDALONE, null, invalid)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("infra.redis.connect-timeout");
        }
    }

    @Nested
    @DisplayName("yml 바인딩")
    class Binding {

        private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(RedisPropertiesConfig.class);

        @Test
        @DisplayName("1s · 2s 같은 Duration 표기를 그대로 받는다")
        void bindsDurations() {
            contextRunner
                .withPropertyValues("infra.redis.command-timeout=1s", "infra.redis.connect-timeout=2s")
                .run(context -> {
                    RedisProperties properties = context.getBean(RedisProperties.class);

                    assertThat(properties.commandTimeout()).isEqualTo(Duration.ofSeconds(1));
                    assertThat(properties.connectTimeout()).isEqualTo(Duration.ofSeconds(2));
                });
        }

        @Test
        @DisplayName("적지 않으면 null 이다 — 기본값을 여기서 채우지 않아야 미지정과 지정이 구분된다")
        void unsetIsNull() {
            contextRunner
                .withPropertyValues("infra.redis.host=localhost")
                .run(context -> {
                    RedisProperties properties = context.getBean(RedisProperties.class);

                    assertThat(properties.commandTimeout()).isNull();
                    assertThat(properties.connectTimeout()).isNull();
                });
        }
    }

    private LettuceConnectionFactory factory(RedisProperties properties) {
        return (LettuceConnectionFactory) configurer.redisConnectionFactory(properties);
    }

    private static LettuceConnectionFactory factoryWithoutClientConfiguration(RedisMode mode) {
        if (mode == RedisMode.SENTINEL) {
            return new LettuceConnectionFactory(new RedisSentinelConfiguration().master("master").sentinel(HOST, 26379));
        }
        return new LettuceConnectionFactory(new RedisStandaloneConfiguration(HOST, PORT));
    }

    private static RedisProperties properties(RedisMode mode, Duration commandTimeout, Duration connectTimeout) {
        String masterName = mode == RedisMode.SENTINEL ? "master" : null;
        String sentinelNodes = mode == RedisMode.SENTINEL ? HOST + ":26379" : null;
        return new RedisProperties(mode, HOST, PORT, masterName, null, null, sentinelNodes, null, commandTimeout, connectTimeout);
    }
}

package com.hondigagae.apigateway.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.convert.DurationStyle;
import org.yaml.snakeyaml.Yaml;

/**
 * 게이트웨이의 Redis 명령·연결 타임아웃이 세 프로파일 모두에 짧게 적혀 있는지 고정한다 (#1253).
 *
 * <p>값이 빠지면 컴파일도 기동도 멀쩡하다 — redis-core 가 Lettuce 기본(명령 60초 · 리액티브 무제한, 연결 10초)으로
 * 조용히 돌아갈 뿐이다. 그 차이는 <b>Redis 가 먹통이 된 날에야</b> 드러난다: 레이트 리밋의 fail-open 이 일어나지
 * 않고, 블랙리스트 판정이 요청마다 60초를 기다린다. 그래서 {@link GatewayRouteCoverageTest} 처럼 yml 을 직접 읽는다.
 */
class GatewayRedisTimeoutConfigTest {

    private static final Duration EXPECTED_COMMAND_TIMEOUT = Duration.ofSeconds(1);
    private static final Duration EXPECTED_CONNECT_TIMEOUT = Duration.ofSeconds(2);

    @ParameterizedTest(name = "application-{0}.yml")
    @ValueSource(strings = {"local", "dev", "prod"})
    @DisplayName("infra.redis 에 command-timeout 1s · connect-timeout 2s 가 있어야 한다")
    void everyProfileSetsShortRedisTimeouts(String profile) throws IOException {
        Map<?, ?> redis = redisSection(profile);

        assertThat(parse(redis.get("command-timeout"), "command-timeout", profile)).isEqualTo(EXPECTED_COMMAND_TIMEOUT);
        assertThat(parse(redis.get("connect-timeout"), "connect-timeout", profile)).isEqualTo(EXPECTED_CONNECT_TIMEOUT);
    }

    private static Map<?, ?> redisSection(String profile) throws IOException {
        try (InputStream yml = GatewayRedisTimeoutConfigTest.class.getResourceAsStream("/application-" + profile + ".yml")) {
            assertThat(yml).as("application-%s.yml 이 클래스패스에 있어야 한다", profile).isNotNull();
            Map<String, Object> root = new Yaml().load(yml);
            return asMap(asMap(root.get("infra"), "infra", profile).get("redis"), "infra.redis", profile);
        }
    }

    private static Duration parse(Object value, String key, String profile) {
        assertThat(value).as("application-%s.yml 의 infra.redis.%s", profile, key).isInstanceOf(String.class);
        return DurationStyle.detectAndParse((String) value);
    }

    private static Map<?, ?> asMap(Object value, String name, String profile) {
        assertThat(value).as("application-%s.yml 의 %s 는 매핑이어야 한다", profile, name).isInstanceOf(Map.class);
        return (Map<?, ?>) value;
    }
}

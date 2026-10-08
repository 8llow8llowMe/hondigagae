package com.hondigagae.redis.config;

import com.hondigagae.redis.properties.RedisProperties;
import com.hondigagae.redis.properties.enums.RedisMode;
import io.lettuce.core.ClientOptions;
import io.lettuce.core.SocketOptions;
import io.lettuce.core.TimeoutOptions;
import java.time.Duration;
import java.util.Optional;
import org.springframework.context.annotation.Bean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisSentinelConfiguration;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration.LettuceClientConfigurationBuilder;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

public class RedisConfigurer {

    @Bean
    public RedisConnectionFactory redisConnectionFactory(RedisProperties redisProperties) {
        RedisMode mode = redisProperties.mode() != null ? redisProperties.mode() : RedisMode.STANDALONE;
        boolean hasPassword = redisProperties.password() != null && !redisProperties.password().isBlank();
        Optional<LettuceClientConfiguration> clientConfiguration = createClientConfiguration(redisProperties);

        return switch (mode) {
            case SENTINEL -> createSentinelConnectionFactory(redisProperties, hasPassword, clientConfiguration);
            case STANDALONE -> createStandaloneConnectionFactory(redisProperties, hasPassword, clientConfiguration);
        };
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory redisConnectionFactory) {
        RedisTemplate<String, Object> redisTemplate = new RedisTemplate<>();
        redisTemplate.setConnectionFactory(redisConnectionFactory);
        redisTemplate.setKeySerializer(new StringRedisSerializer());
        // 주의: 기본 ObjectMapper 라 java.time 타입을 직렬화하지 못한다.
        // 객체 저장이 필요하면 StringRedisTemplate + 서비스 ObjectMapper 로 JSON 문자열을 직접 다룬다.
        redisTemplate.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        // hash 직렬화기를 지정하지 않으면 JDK 직렬화로 폴백한다 — opsForHash 를 쓰는 순간
        // redis-cli 로 읽을 수 없는 바이너리가 저장되므로 key/value 와 같은 정책으로 맞춘다.
        redisTemplate.setHashKeySerializer(new StringRedisSerializer());
        redisTemplate.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        return redisTemplate;
    }

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory redisConnectionFactory) {
        return new StringRedisTemplate(redisConnectionFactory);
    }

    /**
     * Sentinel 접속 구성.
     *
     * <p>설정이 비었을 때 <b>기동 시점에 실패시킨다.</b> 예전에는 masterName 과 노드 목록을
     * 검사하지 않아, sentinel 모드로 띄우면 노드 목록이 null 인 채로 NPE 가 났다.
     * 스택트레이스만 보면 원인이 설정 누락이라는 것이 드러나지 않는다.
     */
    private LettuceConnectionFactory createSentinelConnectionFactory(
        RedisProperties redisProperties, boolean hasPassword, Optional<LettuceClientConfiguration> clientConfiguration
    ) {
        String masterName = redisProperties.masterName();
        if (masterName == null || masterName.isBlank()) {
            throw new IllegalStateException(
                "infra.redis.mode=sentinel 인데 infra.redis.master-name 이 비어 있습니다. "
                    + "REDIS_MASTER_NAME 을 설정하세요.");
        }

        var nodes = redisProperties.resolvedSentinels();
        if (nodes.isEmpty()) {
            throw new IllegalStateException(
                "infra.redis.mode=sentinel 인데 Sentinel 노드가 없습니다. "
                    + "REDIS_SENTINEL_NODES 를 host:port,host:port 형식으로 설정하세요.");
        }

        RedisSentinelConfiguration sentinelConfig = new RedisSentinelConfiguration()
            .master(masterName);

        nodes.forEach(node -> sentinelConfig.sentinel(node.host(), node.port()));

        if (hasPassword) {
            sentinelConfig.setPassword(RedisPassword.of(redisProperties.password()));
        }

        return clientConfiguration
            .map(configuration -> new LettuceConnectionFactory(sentinelConfig, configuration))
            .orElseGet(() -> new LettuceConnectionFactory(sentinelConfig));
    }

    private LettuceConnectionFactory createStandaloneConnectionFactory(
        RedisProperties redisProperties, boolean hasPassword, Optional<LettuceClientConfiguration> clientConfiguration
    ) {
        RedisStandaloneConfiguration standaloneConfig = new RedisStandaloneConfiguration(redisProperties.host(), redisProperties.port());

        if (hasPassword) {
            standaloneConfig.setPassword(RedisPassword.of(redisProperties.password()));
        }

        return clientConfiguration
            .map(configuration -> new LettuceConnectionFactory(standaloneConfig, configuration))
            .orElseGet(() -> new LettuceConnectionFactory(standaloneConfig));
    }

    /**
     * 명령·연결 타임아웃을 적었을 때만 클라이언트 설정을 만든다 (#1253).
     *
     * <p><b>둘 다 비었으면 만들지 않는다.</b> 팩토리를 예전처럼 클라이언트 설정 없이 만들어 Lettuce 기본(명령 60초,
     * 연결 10초)을 그대로 쓴다 — 값을 적지 않은 서비스(auth · tour · ai)는 이 설정이 생기기 전과 같아야 한다.
     *
     * <p><b>명령 타임아웃 감시({@code TimeoutOptions.enabled()})를 함께 켠다.</b> 빌더의 기본 {@code ClientOptions} 에는
     * 이것이 켜져 있는데, 연결 타임아웃을 담으려고 {@code ClientOptions} 를 새로 넘기면 기본이 통째로 바뀌어 감시가
     * 꺼진 Lettuce 기본으로 돌아간다. 그러면 동기 호출은 Spring Data Redis 가 명령 타임아웃에서 끊어 주지만
     * <b>리액티브 명령(게이트웨이 레이트 리밋)에는 상한이 없어진다.</b>
     *
     * <p>끊긴 동안 명령을 쌓아 두는 기본({@code DisconnectedBehavior.DEFAULT})은 바꾸지 않는다. 감시는 명령을 쓰는
     * 시점부터 시간을 재므로 재연결을 기다리며 쌓인 명령도 명령 타임아웃에 끝난다.
     */
    private Optional<LettuceClientConfiguration> createClientConfiguration(RedisProperties redisProperties) {
        if (!redisProperties.hasClientTimeouts()) {
            return Optional.empty();
        }

        SocketOptions.Builder socketOptions = SocketOptions.builder();
        if (redisProperties.connectTimeout() != null) {
            socketOptions.connectTimeout(requirePositive(redisProperties.connectTimeout(), "infra.redis.connect-timeout"));
        }
        ClientOptions clientOptions = ClientOptions.builder()
            .timeoutOptions(TimeoutOptions.enabled())
            .socketOptions(socketOptions.build())
            .build();

        LettuceClientConfigurationBuilder builder = LettuceClientConfiguration.builder().clientOptions(clientOptions);
        if (redisProperties.commandTimeout() != null) {
            builder.commandTimeout(requirePositive(redisProperties.commandTimeout(), "infra.redis.command-timeout"));
        }
        return Optional.of(builder.build());
    }

    /**
     * 0 이하는 기동 시점에 실패시킨다. 0 이면 Spring Data Redis 의 동기 대기가 상한 없이 기다려
     * "짧게 끊으려고 적은 값" 이 정반대로 동작한다.
     */
    private static Duration requirePositive(Duration timeout, String propertyName) {
        if (timeout.isZero() || timeout.isNegative()) {
            throw new IllegalStateException(propertyName + " 값은 0 보다 커야 합니다: " + timeout + ". 비우면 Lettuce 기본을 씁니다.");
        }
        return timeout;
    }
}

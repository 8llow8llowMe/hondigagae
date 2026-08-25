package com.hondigagae.redis.config;

import com.hondigagae.redis.properties.RedisProperties;
import com.hondigagae.redis.properties.enums.RedisMode;
import org.springframework.context.annotation.Bean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisSentinelConfiguration;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
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

        return switch (mode) {
            case SENTINEL -> createSentinelConnectionFactory(redisProperties, hasPassword);
            case STANDALONE -> createStandaloneConnectionFactory(redisProperties, hasPassword);
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
        return redisTemplate;
    }

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory redisConnectionFactory) {
        return new StringRedisTemplate(redisConnectionFactory);
    }

    private LettuceConnectionFactory createSentinelConnectionFactory(RedisProperties redisProperties, boolean hasPassword) {
        RedisSentinelConfiguration sentinelConfig = new RedisSentinelConfiguration()
            .master(redisProperties.masterName());

        redisProperties.sentinels().forEach(node ->
            sentinelConfig.sentinel(node.host(), node.port())
        );

        if (hasPassword) {
            sentinelConfig.setPassword(RedisPassword.of(redisProperties.password()));
        }

        return new LettuceConnectionFactory(sentinelConfig);
    }

    private LettuceConnectionFactory createStandaloneConnectionFactory(RedisProperties redisProperties, boolean hasPassword) {
        RedisStandaloneConfiguration standaloneConfig = new RedisStandaloneConfiguration(redisProperties.host(), redisProperties.port());

        if (hasPassword) {
            standaloneConfig.setPassword(RedisPassword.of(redisProperties.password()));
        }

        return new LettuceConnectionFactory(standaloneConfig);
    }
}

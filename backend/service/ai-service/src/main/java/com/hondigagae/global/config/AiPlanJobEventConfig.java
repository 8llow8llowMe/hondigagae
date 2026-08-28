package com.hondigagae.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

@Configuration
public class AiPlanJobEventConfig {

    /**
     * AI 일정 잡 이벤트(pub/sub) 구독용 컨테이너.
     * 리스너가 하나도 없으면 구독 커넥션을 만들지 않으므로 SSE 미사용 시 오버헤드가 없다.
     */
    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(RedisConnectionFactory redisConnectionFactory) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(redisConnectionFactory);
        return container;
    }
}

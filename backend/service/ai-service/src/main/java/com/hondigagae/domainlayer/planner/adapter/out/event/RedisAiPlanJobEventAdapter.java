package com.hondigagae.domainlayer.planner.adapter.out.event;

import com.hondigagae.domainlayer.planner.application.model.AiPlanJobSubscription;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobEventPort;
import com.hondigagae.redis.properties.RedisProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RedisAiPlanJobEventAdapter implements AiPlanJobEventPort {

    private final StringRedisTemplate stringRedisTemplate;
    private final RedisMessageListenerContainer redisMessageListenerContainer;
    private final RedisProperties redisProperties;

    @Override
    public void publishJobUpdated(String jobId) {
        try {
            stringRedisTemplate.convertAndSend(buildChannel(jobId), jobId);
        } catch (RuntimeException exception) {
            // 발행 실패가 잡 실행 자체를 실패시키면 안 된다. 구독자는 하트비트 재확인과 폴링 폴백으로 종결을 감지한다.
            log.warn("AI 일정 잡 이벤트 발행을 건너뜁니다. jobId={} reason={}", jobId, exception.getMessage());
        }
    }

    @Override
    public AiPlanJobSubscription subscribe(String jobId, Runnable onJobUpdated) {
        MessageListener listener = (message, pattern) -> onJobUpdated.run();
        ChannelTopic topic = new ChannelTopic(buildChannel(jobId));
        redisMessageListenerContainer.addMessageListener(listener, topic);
        return () -> redisMessageListenerContainer.removeMessageListener(listener, topic);
    }

    private String buildChannel(String jobId) {
        return "%s:ai:job:events:%s".formatted(redisProperties.normalizedKeyPrefix(), jobId);
    }
}

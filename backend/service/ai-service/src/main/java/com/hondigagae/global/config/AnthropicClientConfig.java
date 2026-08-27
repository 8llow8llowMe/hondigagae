package com.hondigagae.global.config;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.hondigagae.global.properties.AiLlmProperties;
import java.time.Duration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * LLM 클라이언트 빈.
 *
 * <p>{@code ai-llm.enabled=true} 일 때만 만든다. 키가 없는 로컬/CI 에서 기동이 깨지지 않게
 * 하기 위해서다 - 그 경우 {@code StubLlmAdapter} 가 포트를 채워 비동기 파이프라인은 그대로 돈다.
 *
 * <p>타임아웃을 명시하는 것이 중요하다. SDK 기본값은 10분이라 그대로 두면 워커 스레드가
 * 십 분씩 잡혀 풀이 마른다 (coding-conventions §10).
 *
 * <p>키가 비어 있는데 enabled 가 true 면 <b>기동 시점에 실패시킨다.</b> 그대로 띄우면
 * 사용자가 일정 생성을 눌렀을 때에야 401 로 드러나고, 원인이 설정 누락이라는 것이 보이지 않는다.
 */
@Configuration
@ConditionalOnProperty(prefix = "ai-llm", name = "enabled", havingValue = "true")
public class AnthropicClientConfig {

    @Bean
    public AnthropicClient anthropicClient(AiLlmProperties aiLlmProperties) {
        if (!aiLlmProperties.hasApiKey()) {
            throw new IllegalStateException(
                "ai-llm.enabled=true 인데 ai-llm.api-key 가 비어 있습니다. "
                    + "ANTHROPIC_API_KEY 환경변수를 설정하거나 ai-llm.enabled=false 로 두고 스텁을 쓰세요.");
        }

        return AnthropicOkHttpClient.builder()
            .apiKey(aiLlmProperties.apiKey())
            .timeout(Duration.ofSeconds(aiLlmProperties.timeoutSeconds()))
            .build();
    }
}

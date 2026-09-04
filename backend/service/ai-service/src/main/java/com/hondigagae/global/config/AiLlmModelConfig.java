package com.hondigagae.global.config;

import com.hondigagae.global.properties.AiLlmProperties;
import java.time.Duration;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.web.client.DefaultResponseErrorHandler;
import org.springframework.web.client.RestClient;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Spring AI 모델 빈.
 *
 * <p>항상 만든다. 빈 생성 시점에는 Ollama 에 연결하지 않으므로(Spring AI 는 첫 호출 때 붙는다)
 * LLM 이 없는 로컬/CI 에서도 기동은 깨지지 않는다. provider 별 빈은 {@code ai-llm.provider} 로 고른다.
 */
@Configuration
public class AiLlmModelConfig {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);

    @Bean
    @ConditionalOnProperty(prefix = "ai-llm", name = "provider", havingValue = "OLLAMA", matchIfMissing = true)
    public OllamaApi ollamaApi(RestClient.Builder restClientBuilder, WebClient.Builder webClientBuilder,
        AiLlmProperties properties) {
        // OllamaChatModel.call()은 RestClient 경로를 탄다. 타임아웃을 명시하지 않으면
        // LLM이 멈췄을 때 플랜 워커 스레드가 무기한 점유되므로 ai-llm.timeout-ms를 적용한다.
        ClientHttpRequestFactorySettings requestFactorySettings = ClientHttpRequestFactorySettings.defaults()
            .withConnectTimeout(CONNECT_TIMEOUT)
            .withReadTimeout(Duration.ofMillis(properties.timeoutMs()));
        return OllamaApi.builder()
            .baseUrl(properties.baseUrl())
            .restClientBuilder(
                restClientBuilder.requestFactory(ClientHttpRequestFactoryBuilder.detect().build(requestFactorySettings))
            )
            .webClientBuilder(webClientBuilder)
            .responseErrorHandler(new DefaultResponseErrorHandler())
            .build();
    }

    @Bean
    @ConditionalOnProperty(prefix = "ai-llm", name = "provider", havingValue = "OLLAMA", matchIfMissing = true)
    public OllamaChatModel ollamaChatModel(OllamaApi ollamaApi, AiLlmProperties properties) {
        return OllamaChatModel.builder()
            .ollamaApi(ollamaApi)
            // Spring AI 기본 RetryTemplate은 최대 10회 재시도한다. 타임아웃된 LLM 생성은
            // 다시 보내도 똑같이 느려서 성공 가능성 없이 GPU와 워커 스레드만 점유하므로
            // 내장 재시도를 끄고, 실패 처리는 서킷브레이커 + 잡 상태로 일원화한다.
            .retryTemplate(RetryTemplate.builder().maxAttempts(1).build())
            .defaultOptions(
                OllamaChatOptions.builder()
                    .model(properties.model())
                    .temperature(properties.temperature())
                    .numPredict(properties.maxTokens())
                    // 명시하지 않으면 Ollama 가 2,048 로 잡는다. 모델이 128k 를 지원하든
                    // 그 값이 상한이 되어 프롬프트가 조용히 잘리고, 잘린 자리에 출력 스키마
                    // 지시가 있으면 스키마 밖 응답이 돌아온다 (#232 의 AIPLAN_010).
                    .numCtx(properties.contextTokens())
                    .build()
            )
            .build();
    }
}

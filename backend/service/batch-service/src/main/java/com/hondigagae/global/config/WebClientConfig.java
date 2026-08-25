package com.hondigagae.global.config;

import io.netty.channel.ChannelOption;
import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

@Configuration
public class WebClientConfig {

    private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(10);
    private static final int CONNECT_TIMEOUT_MILLIS = 3000;
    // 목록 응답 한 페이지가 커질 수 있어 기본 256KB 버퍼를 넉넉히 늘린다.
    private static final int MAX_IN_MEMORY_BYTES = 4 * 1024 * 1024;

    /**
     * 공공 데이터 API 호출 공용 WebClient.
     * 외부 호출은 connect/response 타임아웃을 반드시 명시한다 (coding-conventions §10).
     */
    @Bean
    public WebClient openApiWebClient() {
        HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, CONNECT_TIMEOUT_MILLIS)
            .responseTimeout(RESPONSE_TIMEOUT);

        return WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(MAX_IN_MEMORY_BYTES))
            .build();
    }
}

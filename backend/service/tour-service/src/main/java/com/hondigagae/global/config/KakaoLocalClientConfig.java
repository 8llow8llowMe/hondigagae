package com.hondigagae.global.config;

import com.hondigagae.global.properties.KakaoLocalProperties;
import io.netty.channel.ChannelOption;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

/**
 * 카카오 로컬 호출용 WebClient.
 *
 * <p>타임아웃 없는 블로킹 호출을 만들지 않도록 connect/response 를 모두 명시한다
 * (coding-conventions.md §10).
 */
@Configuration
@RequiredArgsConstructor
public class KakaoLocalClientConfig {

    private final KakaoLocalProperties properties;

    @Bean
    public WebClient kakaoLocalWebClient() {
        HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, properties.connectTimeoutMs())
            .responseTimeout(Duration.ofMillis(properties.readTimeoutMs()));

        return WebClient.builder()
            .baseUrl(properties.baseUrl())
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .build();
    }
}

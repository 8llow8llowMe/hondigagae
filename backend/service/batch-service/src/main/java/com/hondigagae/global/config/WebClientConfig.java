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
    /**
     * connect 타임아웃은 커넥터 단위 설정이라 <b>이 클라이언트를 쓰는 모든 원천에 함께 적용된다.</b>
     * 원천별로 달리 잡으려면 WebClient 를 따로 만들어야 한다 - 지금은 그럴 이유가 없어 한 값으로 둔다.
     * (예전에 vworld/mfds 프로퍼티에 connect-timeout-ms 가 있었지만 어디에도 반영되지 않는
     * 거짓 설정이었다. 설정이 있는데 안 먹는 것이 없는 것보다 나쁘다.)
     */
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

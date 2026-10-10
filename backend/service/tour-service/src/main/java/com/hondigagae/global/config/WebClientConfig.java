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

    private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(5);
    private static final int CONNECT_TIMEOUT_MILLIS = 2000;
    // 단기예보 한 회차는 3일치 x 12 category 라 응답이 수백 KB 에 이른다.
    private static final int MAX_IN_MEMORY_BYTES = 4 * 1024 * 1024;

    /**
     * 공공 데이터 API 호출 공용 WebClient.
     *
     * <p>배치와 달리 사용자 요청 경로에서 호출되므로 타임아웃을 짧게 잡는다. 날씨 한 건 때문에
     * 장소 상세 응답이 10초씩 밀리면 안 된다 - 늦느니 스테일 캐시를 쓰는 편이 낫다.
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

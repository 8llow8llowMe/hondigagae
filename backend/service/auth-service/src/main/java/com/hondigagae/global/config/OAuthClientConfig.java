package com.hondigagae.global.config;

import com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao.KakaoApiClient;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao.properties.KakaoOAuthProperties;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.naver.NaverApiClient;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.naver.properties.NaverOAuthProperties;
import io.netty.channel.ChannelOption;
import java.time.Duration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.support.WebClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;
import reactor.netty.http.client.HttpClient;

@Configuration
@EnableConfigurationProperties({KakaoOAuthProperties.class, NaverOAuthProperties.class})
public class OAuthClientConfig {

    private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(10);
    private static final int CONNECT_TIMEOUT_MILLIS = 3000;

    @Bean
    public KakaoApiClient kakaoApiClient() {
        return createHttpInterface(KakaoApiClient.class);
    }

    @Bean
    public NaverApiClient naverApiClient() {
        return createHttpInterface(NaverApiClient.class);
    }

    private <T> T createHttpInterface(Class<T> serviceClass) {
        // provider 응답 지연이 로그인 요청을 무한정 붙잡지 않도록 연결/응답 타임아웃을 둔다.
        HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, CONNECT_TIMEOUT_MILLIS)
            .responseTimeout(RESPONSE_TIMEOUT);

        WebClient client = WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .build();

        return HttpServiceProxyFactory
            .builderFor(WebClientAdapter.create(client))
            .build()
            .createClient(serviceClass);
    }
}

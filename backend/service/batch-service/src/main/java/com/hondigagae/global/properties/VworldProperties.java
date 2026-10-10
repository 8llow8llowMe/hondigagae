package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * VWorld(국토교통부 공간정보 오픈플랫폼) 지오코더 설정.
 *
 * <p>식약처 원천이 주소만 주기 때문에 좌표를 여기서 채운다. 하루 40,000건 무료다.
 * 키는 vworld.kr 에서 발급한다.
 */
@ConfigurationProperties(prefix = "vworld")
public record VworldProperties(
    String baseUrl,
    String apiKey,
    // connect 타임아웃은 여기 두지 않는다. 커넥터 단위 설정이라 openApiWebClient 가 한 번만
    // 정하고, 원천별로 달리 잡으려면 WebClient 를 따로 만들어야 한다 (WebClientConfig 참고).
    int readTimeoutMs
) {

    public VworldProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://api.vworld.kr";
        }
        if (readTimeoutMs <= 0) {
            readTimeoutMs = 10_000;
        }
    }
}

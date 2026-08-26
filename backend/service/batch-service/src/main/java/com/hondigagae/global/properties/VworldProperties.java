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
    int connectTimeoutMs,
    int readTimeoutMs
) {

    public VworldProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://api.vworld.kr";
        }
        if (connectTimeoutMs <= 0) {
            connectTimeoutMs = 3_000;
        }
        if (readTimeoutMs <= 0) {
            readTimeoutMs = 10_000;
        }
    }
}

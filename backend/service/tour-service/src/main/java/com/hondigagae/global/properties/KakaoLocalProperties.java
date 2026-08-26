package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 카카오 로컬 장소 검색 설정.
 *
 * <p>REST API 키는 카카오 개발자센터에서 발급한다. 키가 없으면 기동은 되고 주변 검색 호출 시점에만 실패한다.
 */
@ConfigurationProperties(prefix = "kakao.local")
public record KakaoLocalProperties(
    String baseUrl,
    String restApiKey,
    int connectTimeoutMs,
    int readTimeoutMs
) {

    public KakaoLocalProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://dapi.kakao.com";
        }
        if (connectTimeoutMs <= 0) {
            connectTimeoutMs = 2_000;
        }
        if (readTimeoutMs <= 0) {
            readTimeoutMs = 3_000;
        }
    }
}

package com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "oauth.kakao")
public record KakaoOAuthProperties(
    String clientId,
    String clientSecret,
    String redirectUri,
    String[] scope
) {

}

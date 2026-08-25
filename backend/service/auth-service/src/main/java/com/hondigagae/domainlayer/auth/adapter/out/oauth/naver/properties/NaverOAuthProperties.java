package com.hondigagae.domainlayer.auth.adapter.out.oauth.naver.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "oauth.naver")
public record NaverOAuthProperties(
    String clientId,
    String clientSecret,
    String redirectUri
) {

}

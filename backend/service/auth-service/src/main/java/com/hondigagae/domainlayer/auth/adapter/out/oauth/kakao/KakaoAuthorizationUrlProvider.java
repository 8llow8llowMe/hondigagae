package com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao;

import com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao.properties.KakaoOAuthProperties;
import com.hondigagae.domainlayer.auth.application.port.out.OAuthAuthorizationUrlProvider;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@RequiredArgsConstructor
public class KakaoAuthorizationUrlProvider implements OAuthAuthorizationUrlProvider {

    private final KakaoOAuthProperties kakaoOAuthProperties;

    @Override
    public OAuthProvider supports() {
        return OAuthProvider.KAKAO;
    }

    @Override
    public String generateUrl(String state) {
        return UriComponentsBuilder
            .fromUriString("https://kauth.kakao.com/oauth/authorize")
            .queryParam("response_type", "code")
            .queryParam("client_id", kakaoOAuthProperties.clientId())
            .queryParam("redirect_uri", kakaoOAuthProperties.redirectUri())
            .queryParam("scope", String.join(",", kakaoOAuthProperties.scope()))
            .queryParam("state", state)
            .toUriString();
    }
}

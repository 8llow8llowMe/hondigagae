package com.hondigagae.domainlayer.auth.adapter.out.oauth.naver;

import com.hondigagae.domainlayer.auth.adapter.out.oauth.naver.properties.NaverOAuthProperties;
import com.hondigagae.domainlayer.auth.application.port.out.OAuthAuthorizationUrlProvider;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@RequiredArgsConstructor
public class NaverAuthorizationUrlProvider implements OAuthAuthorizationUrlProvider {

    private final NaverOAuthProperties naverOAuthProperties;

    @Override
    public OAuthProvider supports() {
        return OAuthProvider.NAVER;
    }

    @Override
    public String generateUrl(String state) {
        return UriComponentsBuilder
            .fromUriString("https://nid.naver.com/oauth2.0/authorize")
            .queryParam("response_type", "code")
            .queryParam("client_id", naverOAuthProperties.clientId())
            .queryParam("redirect_uri", naverOAuthProperties.redirectUri())
            .queryParam("state", state)
            .toUriString();
    }
}

package com.hondigagae.domainlayer.auth.adapter.in.web.presenter;

import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthLoginResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthOAuthAuthorizeResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.TokenReissueResponse;
import com.hondigagae.domainlayer.auth.application.info.JwtTokenIssueInfo;
import com.hondigagae.domainlayer.auth.application.info.JwtTokenReissueInfo;
import org.springframework.stereotype.Component;

@Component
public class AuthPresenter {

    public AuthLoginResponse toLoginResponse(JwtTokenIssueInfo info) {
        return AuthLoginResponse.builder()
            .accessToken(info.accessToken())
            .memberId(String.valueOf(info.memberId()))
            .build();
    }

    public TokenReissueResponse toTokenReissueResponse(JwtTokenReissueInfo info) {
        return TokenReissueResponse.builder()
            .accessToken(info.accessToken())
            .build();
    }

    public AuthOAuthAuthorizeResponse toOAuthAuthorizeResponse(String authorizationUrl) {
        return AuthOAuthAuthorizeResponse.builder()
            .authorizationUrl(authorizationUrl)
            .build();
    }
}

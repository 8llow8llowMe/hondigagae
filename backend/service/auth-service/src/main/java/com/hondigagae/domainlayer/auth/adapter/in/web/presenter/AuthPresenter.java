package com.hondigagae.domainlayer.auth.adapter.in.web.presenter;

import java.util.List;
import com.hondigagae.domainlayer.auth.application.info.AuthSessionInfo;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthSessionsResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.item.AuthSessionItem;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthGeneralLoginResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthOAuthAuthorizeResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.TokenReissueResponse;
import com.hondigagae.domainlayer.auth.application.info.JwtTokenIssueInfo;
import com.hondigagae.domainlayer.auth.application.info.JwtTokenReissueInfo;
import org.springframework.stereotype.Component;

@Component
public class AuthPresenter {

    public AuthSessionsResponse toSessionsResponse(List<AuthSessionInfo> sessions) {
        List<AuthSessionItem> items = sessions.stream()
            .map(session -> AuthSessionItem.builder()
                .sessionId(session.sessionId())
                .lastRefreshedAt(session.lastRefreshedAt())
                .current(session.current())
                .build())
            .toList();
        return AuthSessionsResponse.builder()
            .sessions(items)
            .totalCount(items.size())
            .build();
    }

    public AuthGeneralLoginResponse toGeneralLoginResponse(JwtTokenIssueInfo info) {
        return AuthGeneralLoginResponse.builder()
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

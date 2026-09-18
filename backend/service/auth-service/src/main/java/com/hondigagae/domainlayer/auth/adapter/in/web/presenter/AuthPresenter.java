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
import com.hondigagae.domainlayer.auth.application.info.OAuthAuthorizationInfo;
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

    /** state 는 응답 바디에 싣지 않는다 — 브라우저에는 쿠키로만 내려가고 URL 안에만 노출된다. */
    public AuthOAuthAuthorizeResponse toOAuthAuthorizeResponse(OAuthAuthorizationInfo info) {
        return AuthOAuthAuthorizeResponse.builder()
            .authorizationUrl(info.authorizationUrl())
            .build();
    }
}

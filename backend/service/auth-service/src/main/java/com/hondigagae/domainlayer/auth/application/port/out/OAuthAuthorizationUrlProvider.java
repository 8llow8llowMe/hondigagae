package com.hondigagae.domainlayer.auth.application.port.out;

import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;

public interface OAuthAuthorizationUrlProvider {

    OAuthProvider supports();

    /**
     * @param state CSRF 방어용 일회성 토큰. 인가 URL에 반드시 포함되어 콜백에서 검증된다.
     */
    String generateUrl(String state);
}

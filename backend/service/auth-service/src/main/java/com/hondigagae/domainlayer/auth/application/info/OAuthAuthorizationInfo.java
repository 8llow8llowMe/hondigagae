package com.hondigagae.domainlayer.auth.application.info;

import lombok.Builder;

/**
 * 인가 URL 발급 결과. URL 과 <b>거기 실린 state 원문</b>을 함께 돌려준다.
 *
 * <p>state 를 따로 내보내는 이유는 web 계층이 그것을 쿠키로도 심어야 하기 때문이다. URL 에서
 * 다시 파싱해 꺼내는 방법도 있지만, 그러면 provider 별 URL 형식이 바뀔 때마다 조용히 깨진다.
 */
@Builder
public record OAuthAuthorizationInfo(
    String authorizationUrl,
    String state
) {

    public static OAuthAuthorizationInfo of(String authorizationUrl, String state) {
        return OAuthAuthorizationInfo.builder()
            .authorizationUrl(authorizationUrl)
            .state(state)
            .build();
    }
}

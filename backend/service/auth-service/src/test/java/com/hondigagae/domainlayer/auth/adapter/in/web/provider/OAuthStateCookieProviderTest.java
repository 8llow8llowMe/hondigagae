package com.hondigagae.domainlayer.auth.adapter.in.web.provider;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.auth.application.service.processor.OAuthLoginProcessor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.http.ResponseCookie;

/**
 * state 쿠키의 속성을 고정한다.
 *
 * <p>이 쿠키가 하는 일은 "인가 URL 을 발급받은 브라우저"와 "provider 에서 인증한 브라우저"가
 * 같음을 증명하는 것뿐이라, 값 자체보다 <b>속성</b>이 방어력을 결정한다. 하나라도 느슨해지면
 * 쿠키를 심었다는 사실만 남고 막는 힘은 사라지므로 여기서 못 박는다.
 */
class OAuthStateCookieProviderTest {

    private static final String STATE = "0123456789abcdef0123456789abcdef";

    @Test
    @DisplayName("state 쿠키는 HttpOnly·Strict·auth 경로로 심어지고 수명이 state TTL 과 같다")
    void createsHardenedStateCookie() {
        ResponseCookie cookie = provider("dev").createStateCookie(STATE);

        assertThat(cookie.getName()).isEqualTo("oauthState");
        assertThat(cookie.getValue()).isEqualTo(STATE);
        // 스크립트가 읽으면 XSS 한 번으로 double-submit 이 통째로 무력화된다.
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getSameSite()).isEqualTo("Strict");
        // authorize(심기)와 login(읽기)이 함께 지나는 경로.
        assertThat(cookie.getPath()).isEqualTo("/api/v1/auth");
        // Redis 의 state 와 수명이 갈리면, 쿠키가 먼저 죽었을 때 정상 사용자가 거부된다.
        assertThat(cookie.getMaxAge()).isEqualTo(OAuthLoginProcessor.STATE_TTL);
    }

    @Test
    @DisplayName("쿠키 만료는 같은 속성에 maxAge 0 으로 나간다")
    void clearsStateCookieWithSameAttributes() {
        // 속성이 하나라도 다르면 브라우저가 "다른 쿠키"로 보고 원본을 지우지 않는다 —
        // state 일회성이 쿠키 쪽에서만 풀린다.
        ResponseCookie cookie = provider("dev").clearStateCookie();

        assertThat(cookie.getName()).isEqualTo("oauthState");
        assertThat(cookie.getValue()).isEmpty();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getSameSite()).isEqualTo("Strict");
        assertThat(cookie.getPath()).isEqualTo("/api/v1/auth");
        assertThat(cookie.getMaxAge()).isZero();
    }

    @Test
    @DisplayName("secure 는 local 프로필에서만 꺼진다 — dev 도 https 로 서비스된다")
    void marksSecureExceptLocalProfile() {
        // prod 만 보면 dev 의 state 가 평문 http 요청에 실려 나갈 수 있다. refresh 쿠키와 같은 판정.
        assertThat(provider("local").createStateCookie(STATE).isSecure()).isFalse();
        assertThat(provider("dev").createStateCookie(STATE).isSecure()).isTrue();
        assertThat(provider("prod").createStateCookie(STATE).isSecure()).isTrue();
        assertThat(provider("local").clearStateCookie().isSecure()).isFalse();
    }

    private OAuthStateCookieProvider provider(String activeProfile) {
        StandardEnvironment environment = new StandardEnvironment();
        environment.setActiveProfiles(activeProfile);
        return new OAuthStateCookieProvider(environment);
    }
}

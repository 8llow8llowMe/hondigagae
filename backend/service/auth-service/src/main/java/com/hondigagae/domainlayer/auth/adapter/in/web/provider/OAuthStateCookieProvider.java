package com.hondigagae.domainlayer.auth.adapter.in.web.provider;

import com.hondigagae.domainlayer.auth.application.service.processor.OAuthLoginProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * 소셜 로그인 state 를 <b>요청한 브라우저에 묶는</b> 쿠키를 만든다.
 *
 * <p>state 를 Redis 에만 두면 인가 URL 을 발급받은 주체와 provider 에서 인증하는 주체가 다를 수
 * 있다. 공격자가 동의를 켠 인가 URL 을 피해자에게 클릭시키면 피해자 이름으로 동의 이력이 남는다.
 * 그래서 발급한 state 를 쿠키로도 내려보내고, 콜백에서 쿼리 state 와 쿠키 state 가 같을 때만
 * 소비한다(double-submit). 공격자가 만든 state 는 피해자 브라우저에 없으므로 콜백이 거부된다.
 *
 * <p><b>{@code SameSite=Strict} 로도 동작하는 이유</b> — 이 저장소는 브라우저가 게이트웨이를
 * 직접 부르지 않는다. provider 콜백을 프론트가 <i>자기 오리진</i>으로 받고, 게이트웨이 호출은
 * <b>BFF 가 서버에서</b> 한다. 즉 이 쿠키는 브라우저↔게이트웨이 사이를 직접 오가지 않고 BFF 가
 * 꺼내 자기 세션에 봉인했다가 되돌려준다 (refresh 토큰과 똑같은 취급이다). 그래서 크로스사이트
 * 리다이렉트 전송 문제가 애초에 없고, 속성은 가장 좁은 {@code Strict} 로 둘 수 있다.
 */
@Component
@RequiredArgsConstructor
public class OAuthStateCookieProvider {

    /** 쿠키 이름의 단일 소유자. 컨트롤러의 @CookieValue 도 이 상수를 참조한다. */
    public static final String OAUTH_STATE_COOKIE = "oauthState";
    // authorize(심기) 와 login(읽기) 가 함께 쓰는 경로다. refresh 쿠키와 같은 스코프를 쓴다 —
    // 더 좁히면 두 엔드포인트마다 경로를 나눠야 하고, 더 넓히면 auth 밖 요청에도 실려 나간다.
    private static final String AUTH_PATH = "/api/v1/auth";

    private final Environment environment;

    /**
     * Redis 의 state 와 <b>같은 수명</b>을 준다. 쿠키가 먼저 죽으면 아직 유효한 state 를 가진
     * 정상 사용자가 거부되고, 늦게 죽으면 이미 소비된 state 의 쿠키가 남아 브라우저에 쓰레기가
     * 쌓인다. 그래서 TTL 상수를 복제하지 않고 발급하는 쪽의 값을 그대로 가져다 쓴다.
     */
    public ResponseCookie createStateCookie(String state) {
        return ResponseCookie.from(OAUTH_STATE_COOKIE, state)
            .httpOnly(true)
            .secure(isSecure())
            .sameSite("Strict")
            .path(AUTH_PATH)
            .maxAge(OAuthLoginProcessor.STATE_TTL.getSeconds())
            .build();
    }

    /** state 는 일회성이다. 콜백이 성공하든 실패하든 이 쿠키는 그 요청에서 지운다. */
    public ResponseCookie clearStateCookie() {
        return ResponseCookie.from(OAUTH_STATE_COOKIE, "")
            .httpOnly(true)
            .secure(isSecure())
            .sameSite("Strict")
            .path(AUTH_PATH)
            .maxAge(0)
            .build();
    }

    private boolean isSecure() {
        // refresh 쿠키와 같은 판정이다 — "https 로 서비스되는가"가 기준이고, dev 도
        // https(dev.hondigagae.com)로 서비스되므로 평문 http 인 로컬(local 프로필)만 제외한다.
        return !environment.acceptsProfiles(Profiles.of("local"));
    }
}

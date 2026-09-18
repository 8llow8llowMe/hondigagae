package com.hondigagae.domainlayer.auth.application.port.in;

import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthSessionsResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthGeneralLoginResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthOAuthAuthorizeResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.TokenReissueResponse;
import com.hondigagae.domainlayer.auth.application.command.AuthGeneralLoginCommand;
import com.hondigagae.domainlayer.auth.application.command.TokenReissueCommand;
import com.hondigagae.domainlayer.auth.application.info.AuthCookieResult;
import com.hondigagae.domainlayer.auth.application.info.OAuthStateCookieResult;
import com.hondigagae.domainlayer.auth.application.model.OAuthSignupConsent;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;

public interface AuthWebUseCase {

    AuthCookieResult<AuthGeneralLoginResponse> generalLogin(AuthGeneralLoginCommand command);

    /** 현재 기기 세션만 로그아웃한다. refreshToken 은 요청 쿠키 값으로, 없으면 access 무효화만 수행한다. */
    void logout(long memberId, String tokenId, String refreshToken);

    /** 로그인 기기 목록. refreshToken(쿠키)은 현재 기기 표시용이며 없어도 된다. */
    AuthSessionsResponse getMySessions(long memberId, String refreshToken);

    /** 특정 기기 세션 무효화(원격 로그아웃). 멱등. */
    void revokeSession(long memberId, String sessionId);

    AuthCookieResult<TokenReissueResponse> reissueToken(TokenReissueCommand command);

    /** clientIp 는 IP 기준 발송 상한 검사에 쓴다. */
    void sendEmailVerificationCode(String email, String clientIp);

    /** 비밀번호 재설정 코드 발송. 계정 존재 여부와 무관하게 항상 성공으로 응답한다. */
    void sendPasswordResetCode(String email, String clientIp);

    /** 코드 검증 후 비밀번호를 재설정하고 전 기기 세션을 무효화한다. */
    void resetPassword(String email, String code, String newPassword);

    void verifyEmailVerificationCode(String email, String code);

    /**
     * 인가 URL을 생성한다. consent 는 이 연동이 신규 가입이 될 때만 쓰이며, state 와 함께
     * 보관됐다가 콜백에서 소비된다 (인가코드가 1회용이라 콜백에서 동의를 새로 받을 수 없다).
     *
     * <p>state 원문을 함께 돌려주는 것은 컨트롤러가 그 값을 쿠키로도 심어야 하기 때문이다.
     */
    OAuthStateCookieResult<AuthOAuthAuthorizeResponse> generateOAuthAuthorizationUrl(OAuthProvider provider, OAuthSignupConsent consent);

    /**
     * 소셜 콜백 로그인. cookieState 는 인가 응답에 심은 state 쿠키 값이며, 쿼리 state 와 일치할
     * 때만 state 를 소비한다 — 없거나 다르면 {@code INVALID_OAUTH_STATE} 로 거부한다.
     */
    AuthCookieResult<AuthGeneralLoginResponse> oauthLogin(OAuthProvider provider, String authCode, String state, String cookieState);
}

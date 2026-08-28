package com.hondigagae.domainlayer.auth.application.port.in;

import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthGeneralLoginResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthOAuthAuthorizeResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.TokenReissueResponse;
import com.hondigagae.domainlayer.auth.application.command.AuthGeneralLoginCommand;
import com.hondigagae.domainlayer.auth.application.command.TokenReissueCommand;
import com.hondigagae.domainlayer.auth.application.info.AuthCookieResult;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;

public interface AuthWebUseCase {

    AuthCookieResult<AuthGeneralLoginResponse> generalLogin(AuthGeneralLoginCommand command);

    /** 현재 기기 세션만 로그아웃한다. refreshToken 은 요청 쿠키 값으로, 없으면 access 무효화만 수행한다. */
    void logout(long memberId, String tokenId, String refreshToken);

    AuthCookieResult<TokenReissueResponse> reissueToken(TokenReissueCommand command);

    /** clientIp 는 IP 기준 발송 상한 검사에 쓴다. */
    void sendEmailVerificationCode(String email, String clientIp);

    void verifyEmailVerificationCode(String email, String code);

    AuthOAuthAuthorizeResponse generateOAuthAuthorizationUrl(OAuthProvider provider);

    AuthCookieResult<AuthGeneralLoginResponse> oauthLogin(OAuthProvider provider, String authCode, String state);
}

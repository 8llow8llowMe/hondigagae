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

    void logout(long memberId, String tokenId);

    AuthCookieResult<TokenReissueResponse> reissueToken(TokenReissueCommand command);

    void sendEmailVerificationCode(String email);

    void verifyEmailVerificationCode(String email, String code);

    AuthOAuthAuthorizeResponse generateOAuthAuthorizationUrl(OAuthProvider provider);

    AuthCookieResult<AuthGeneralLoginResponse> oauthLogin(OAuthProvider provider, String authCode, String state);
}

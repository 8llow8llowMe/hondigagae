package com.hondigagae.domainlayer.auth.application.port.in;

import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthLoginResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthOAuthAuthorizeResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.TokenReissueResponse;
import com.hondigagae.domainlayer.auth.application.command.KakaoLoginCommand;
import com.hondigagae.domainlayer.auth.application.command.TokenReissueCommand;
import com.hondigagae.domainlayer.auth.application.info.AuthCookieResult;

public interface AuthWebUseCase {

    AuthOAuthAuthorizeResponse generateKakaoAuthorizationUrl();

    AuthCookieResult<AuthLoginResponse> kakaoLogin(KakaoLoginCommand command);

    AuthCookieResult<TokenReissueResponse> reissueToken(TokenReissueCommand command);

    void logout(long memberId, String tokenId);
}

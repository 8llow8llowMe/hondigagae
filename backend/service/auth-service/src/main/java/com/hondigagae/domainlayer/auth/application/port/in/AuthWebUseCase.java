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

    /** 비밀번호 재설정 코드 발송. 계정 존재 여부와 무관하게 항상 성공으로 응답한다. */
    void sendPasswordResetCode(String email, String clientIp);

    /** 코드 검증 후 비밀번호를 재설정하고 전 기기 세션을 무효화한다. */
    void resetPassword(String email, String code, String newPassword);

    void verifyEmailVerificationCode(String email, String code);

    AuthOAuthAuthorizeResponse generateOAuthAuthorizationUrl(OAuthProvider provider);

    AuthCookieResult<AuthGeneralLoginResponse> oauthLogin(OAuthProvider provider, String authCode, String state);
}

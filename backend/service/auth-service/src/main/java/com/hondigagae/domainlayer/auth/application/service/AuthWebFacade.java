package com.hondigagae.domainlayer.auth.application.service;

import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthLoginResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthOAuthAuthorizeResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.TokenReissueResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.presenter.AuthPresenter;
import com.hondigagae.domainlayer.auth.application.command.KakaoLoginCommand;
import com.hondigagae.domainlayer.auth.application.command.TokenReissueCommand;
import com.hondigagae.domainlayer.auth.application.info.AuthCookieResult;
import com.hondigagae.domainlayer.auth.application.info.JwtTokenIssueInfo;
import com.hondigagae.domainlayer.auth.application.info.JwtTokenReissueInfo;
import com.hondigagae.domainlayer.auth.application.info.LoginInfo;
import com.hondigagae.domainlayer.auth.application.port.in.AuthWebUseCase;
import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthMemberQueryResult;
import com.hondigagae.domainlayer.auth.application.service.processor.JwtTokenProcessor;
import com.hondigagae.domainlayer.auth.application.service.processor.KakaoLoginProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthWebFacade implements AuthWebUseCase {

    private final KakaoLoginProcessor kakaoLoginProcessor;
    private final JwtTokenProcessor jwtTokenProcessor;
    private final AuthPresenter authPresenter;

    @Override
    public AuthOAuthAuthorizeResponse generateKakaoAuthorizationUrl() {
        String authorizationUrl = kakaoLoginProcessor.generateAuthorizationUrl();
        return authPresenter.toOAuthAuthorizeResponse(authorizationUrl);
    }

    @Override
    public AuthCookieResult<AuthLoginResponse> kakaoLogin(KakaoLoginCommand command) {
        // 1. state 검증 + 카카오 프로필 조회 — 외부 HTTP 왕복이므로 트랜잭션 밖에서 수행한다.
        OAuthMemberQueryResult kakaoMember = kakaoLoginProcessor.fetchKakaoMember(command.authCode(), command.state());

        // 2. 회원 조회/생성 (Processor의 트랜잭션 경계) 후 토큰 발급
        LoginInfo loginInfo = kakaoLoginProcessor.login(kakaoMember);
        JwtTokenIssueInfo jwtTokenIssueInfo = jwtTokenProcessor.issueTokens(loginInfo.memberId(), loginInfo.role());

        // 3. Presenter를 통한 Info -> Response 변환
        AuthLoginResponse response = authPresenter.toLoginResponse(jwtTokenIssueInfo);

        return AuthCookieResult.of(response, jwtTokenIssueInfo.refreshToken());
    }

    @Override
    @Transactional
    public AuthCookieResult<TokenReissueResponse> reissueToken(TokenReissueCommand command) {
        // 1. 토큰 재발급 수행
        JwtTokenReissueInfo jwtTokenReissueInfo = jwtTokenProcessor.reissueTokens(command.refreshToken());

        // 2. Presenter를 통한 Info -> Response 변환
        TokenReissueResponse response = authPresenter.toTokenReissueResponse(jwtTokenReissueInfo);

        return AuthCookieResult.of(response, jwtTokenReissueInfo.newRefreshToken());
    }

    @Override
    public void logout(long memberId, String tokenId) {
        jwtTokenProcessor.revokeToken(memberId, tokenId);
    }
}

package com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao;

import com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao.dto.KakaoAccount;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao.dto.KakaoMemberResponse;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao.dto.KakaoProfile;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao.dto.KakaoToken;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.kakao.properties.KakaoOAuthProperties;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.support.OAuthApiCallSupport;
import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.port.out.KakaoMemberQueryPort;
import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthMemberQueryResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;

@Slf4j
@Component
@RequiredArgsConstructor
public class KakaoMemberQueryAdapter implements KakaoMemberQueryPort {

    private final KakaoApiClient kakaoApiClient;
    private final KakaoOAuthProperties kakaoOAuthProperties;
    private final OAuthApiCallSupport oauthApiCallSupport;

    @Override
    public OAuthMemberQueryResult fetchMember(String authCode) {
        // 1. 인가코드 -> 액세스 토큰 교환 (HTTP 오류/오류 바디는 도메인 예외로 변환)
        KakaoToken token = oauthApiCallSupport.call(
            () -> kakaoApiClient.fetchToken(buildTokenRequestParams(authCode)));
        validateToken(token);

        // 2. 사용자 프로필 조회
        KakaoMemberResponse response = oauthApiCallSupport.call(
            () -> kakaoApiClient.fetchMember("Bearer " + token.accessToken()));

        // 3. 부분 동의(항목 미제공)에 안전하게 QueryResult로 변환
        KakaoAccount account = response.kakaoAccount();
        KakaoProfile profile = account == null ? null : account.profile();

        return OAuthMemberQueryResult.builder()
            .kakaoId(response.id())
            // 카카오는 미검증 이메일도 내려줄 수 있으므로 두 플래그가 모두 true일 때만 저장한다.
            .email(resolveVerifiedEmail(account))
            .nickname(profile == null ? null : profile.nickname())
            .profileImageUrl(profile == null ? null : profile.profileImageUrl())
            .build();
    }

    private String resolveVerifiedEmail(KakaoAccount account) {
        if (account == null || !account.isEmailValid() || !account.isEmailVerified()) {
            return null;
        }
        return account.email();
    }

    private void validateToken(KakaoToken token) {
        if (StringUtils.hasText(token.error()) || !StringUtils.hasText(token.accessToken())) {
            log.warn("[KakaoMemberQueryAdapter] 토큰 교환 실패: error={}", token.error());
            throw new AuthException(AuthErrorCode.OAUTH_AUTHORIZATION_FAILED);
        }
    }

    private MultiValueMap<String, String> buildTokenRequestParams(String authCode) {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "authorization_code");
        params.add("client_id", kakaoOAuthProperties.clientId());
        params.add("client_secret", kakaoOAuthProperties.clientSecret());
        params.add("redirect_uri", kakaoOAuthProperties.redirectUri());
        params.add("code", authCode);
        return params;
    }
}

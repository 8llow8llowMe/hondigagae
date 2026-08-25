package com.hondigagae.domainlayer.auth.adapter.out.oauth.naver;

import com.hondigagae.domainlayer.auth.adapter.out.oauth.naver.dto.NaverAccount;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.naver.dto.NaverMemberResponse;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.naver.dto.NaverToken;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.naver.properties.NaverOAuthProperties;
import com.hondigagae.domainlayer.auth.adapter.out.oauth.support.OAuthApiCallSupport;
import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.port.out.OAuthMemberQueryPort;
import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthMemberQueryResult;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;

@Slf4j
@Component
@RequiredArgsConstructor
public class NaverMemberQueryAdapter implements OAuthMemberQueryPort {

    private static final String PROFILE_SUCCESS_CODE = "00";

    private final NaverApiClient naverApiClient;
    private final NaverOAuthProperties naverOAuthProperties;
    private final OAuthApiCallSupport oauthApiCallSupport;

    @Override
    public OAuthProvider supports() {
        return OAuthProvider.NAVER;
    }

    @Override
    public OAuthMemberQueryResult fetchMember(String authCode, String state) {
        // 1. 인가코드 -> 액세스 토큰 교환 (네이버는 실패 시에도 200 + error 바디를 반환한다)
        NaverToken token = oauthApiCallSupport.call(
            () -> naverApiClient.fetchToken(buildTokenRequestParams(authCode, state)), OAuthProvider.NAVER);
        validateToken(token);

        // 2. 사용자 프로필 조회 (resultcode != "00" 이면 response가 없다)
        NaverMemberResponse response = oauthApiCallSupport.call(
            () -> naverApiClient.fetchMember("Bearer " + token.accessToken()), OAuthProvider.NAVER);
        NaverAccount account = validateProfile(response);

        return OAuthMemberQueryResult.builder()
            .email(account.email())
            // 네이버는 검증 여부 플래그를 제공하지 않지만, 계정에 등록된 연락처 이메일이라 신뢰한다.
            .emailVerified(StringUtils.hasText(account.email()))
            .name(account.name())
            .nickname(account.nickname())
            .profileImageUrl(account.profileImage())
            .build();
    }

    private void validateToken(NaverToken token) {
        if (StringUtils.hasText(token.error()) || !StringUtils.hasText(token.accessToken())) {
            log.warn("[NaverMemberQueryAdapter] 토큰 교환 실패: error={}", token.error());
            throw new AuthException(AuthErrorCode.OAUTH_AUTHORIZATION_FAILED);
        }
    }

    private NaverAccount validateProfile(NaverMemberResponse response) {
        if (!PROFILE_SUCCESS_CODE.equals(response.resultCode()) || response.response() == null) {
            log.warn("[NaverMemberQueryAdapter] 프로필 조회 실패: resultCode={}, message={}",
                response.resultCode(), response.message());
            throw new AuthException(AuthErrorCode.OAUTH_AUTHORIZATION_FAILED);
        }
        return response.response();
    }

    private MultiValueMap<String, String> buildTokenRequestParams(String authCode, String state) {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "authorization_code");
        params.add("client_id", naverOAuthProperties.clientId());
        params.add("client_secret", naverOAuthProperties.clientSecret());
        params.add("code", authCode);
        params.add("state", state);
        return params;
    }
}

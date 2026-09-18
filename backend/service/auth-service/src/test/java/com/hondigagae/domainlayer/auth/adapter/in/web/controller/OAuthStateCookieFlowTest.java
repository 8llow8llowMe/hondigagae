package com.hondigagae.domainlayer.auth.adapter.in.web.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthGeneralLoginResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthOAuthAuthorizeResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthSessionsResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.TokenReissueResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.provider.OAuthStateCookieProvider;
import com.hondigagae.domainlayer.auth.adapter.in.web.provider.RefreshCookieProvider;
import com.hondigagae.domainlayer.auth.adapter.in.web.support.ClientIpResolver;
import com.hondigagae.domainlayer.auth.application.command.AuthGeneralLoginCommand;
import com.hondigagae.domainlayer.auth.application.command.TokenReissueCommand;
import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.info.AuthCookieResult;
import com.hondigagae.domainlayer.auth.application.info.OAuthStateCookieResult;
import com.hondigagae.domainlayer.auth.application.model.OAuthSignupConsent;
import com.hondigagae.domainlayer.auth.application.port.in.AuthWebUseCase;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.security.auth.config.AuthSecurityConfigurer;
import com.hondigagae.security.auth.config.JwtAuthPropertiesConfig;
import jakarta.servlet.http.Cookie;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * state 쿠키가 <b>요청 하나를 온전히 왕복하는지</b>를 실제 MVC 경로로 고정한다 (#681).
 *
 * <p>프로세서 단위 테스트는 "쿠키가 다르면 거부한다"까지만 본다. 여기서 확인하는 것은 그 앞뒤다 —
 * 인가 응답이 쿠키를 심는가, 그리고 <b>거부된 콜백 응답도 쿠키를 지우는가</b>. 뒤쪽이 이 테스트의
 * 이유다. 만료 헤더를 {@code ResponseEntity} 에만 달면 성공 경로에서만 지워지고, 예외 핸들러를
 * 타고 나가는 실패 응답에는 실리지 않아 쓰다 만 state 쿠키가 브라우저에 남는다.
 */
@WebMvcTest(controllers = AuthWebController.class)
@Import({
    AuthSecurityConfigurer.class, JwtAuthPropertiesConfig.class,
    RefreshCookieProvider.class, OAuthStateCookieProvider.class, ClientIpResolver.class,
    OAuthStateCookieFlowTest.StubUseCaseConfig.class
})
@TestPropertySource(properties = {
    "jwt.access-key=hondigagae-test-jwt-access-key-0123456789abcdef0123456789abcdef0123456789abcdef",
    "jwt.access-expiration=30m",
    "jwt.refresh-key=hondigagae-test-jwt-refresh-key-0123456789abcdef0123456789abcdef0123456789abcdef",
    "jwt.refresh-expiration=14d",
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false"
})
class OAuthStateCookieFlowTest {

    private static final String STATE = "0123456789abcdef0123456789abcdef";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StubAuthWebUseCase useCase;

    @BeforeEach
    void resetStub() {
        // 스텁은 컨텍스트에 붙은 싱글턴이라 테스트 간에 상태가 넘어간다.
        useCase.receivedCookieState = null;
        useCase.failWithInvalidState = false;
    }

    @Test
    @DisplayName("인가 URL 응답이 state 쿠키를 심는다")
    void authorizePlantsStateCookie() throws Exception {
        MockHttpServletResponse response = mockMvc.perform(get("/api/v1/auth/kakao/authorize")
                .param("termsAgreed", "true").param("privacyAgreed", "true").param("ageOver14Confirmed", "true"))
            .andExpect(status().isOk())
            .andReturn().getResponse();

        assertThat(stateCookies(response)).singleElement().asString()
            .contains("oauthState=" + STATE)
            .contains("HttpOnly")
            .contains("SameSite=Strict")
            .contains("Path=/api/v1/auth")
            .contains("Max-Age=600");
    }

    @Test
    @DisplayName("콜백이 성공하면 refresh 쿠키를 심으면서 state 쿠키는 만료시킨다")
    void successfulCallbackClearsStateCookieAndSetsRefreshCookie() throws Exception {
        MockHttpServletResponse response = mockMvc.perform(get("/api/v1/auth/kakao/login")
                .param("code", "auth-code").param("state", STATE)
                .cookie(new Cookie(OAuthStateCookieProvider.OAUTH_STATE_COOKIE, STATE)))
            .andExpect(status().isOk())
            .andReturn().getResponse();

        // 컨트롤러가 쿠키 값을 그대로 유스케이스로 내려보내는지 — 여기가 끊기면 검증 자체가 무력해진다.
        assertThat(useCase.receivedCookieState).isEqualTo(STATE);
        assertThat(stateCookies(response)).singleElement().asString().contains("oauthState=;").contains("Max-Age=0");
        assertThat(response.getHeaders(HttpHeaders.SET_COOKIE)).anyMatch(header -> header.startsWith("refreshToken="));
    }

    @Test
    @DisplayName("쿠키가 없어 거부된 콜백 응답도 state 쿠키를 만료시킨다")
    void rejectedCallbackStillClearsStateCookie() throws Exception {
        useCase.failWithInvalidState = true;

        MockHttpServletResponse response = mockMvc.perform(get("/api/v1/auth/kakao/login")
                .param("code", "auth-code").param("state", STATE))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.dataHeader.resultCode").value(AuthErrorCode.INVALID_OAUTH_STATE.getCode()))
            .andReturn().getResponse();

        // 쿠키가 아예 오지 않았음을 유스케이스가 null 로 받는다 (구버전 프론트의 과도기 요청).
        assertThat(useCase.receivedCookieState).isNull();
        assertThat(stateCookies(response)).singleElement().asString().contains("oauthState=;").contains("Max-Age=0");
    }

    private List<String> stateCookies(MockHttpServletResponse response) {
        return response.getHeaders(HttpHeaders.SET_COOKIE).stream()
            .filter(header -> header.startsWith(OAuthStateCookieProvider.OAUTH_STATE_COOKIE + "="))
            .toList();
    }

    @TestConfiguration
    static class StubUseCaseConfig {

        @Bean
        StubAuthWebUseCase stubAuthWebUseCase() {
            return new StubAuthWebUseCase();
        }
    }

    /**
     * 유스케이스는 이 테스트의 관심사가 아니라 손수 만든 스텁으로 둔다 — 보는 것은 컨트롤러가
     * 무엇을 내려보내고 무엇을 헤더에 싣는가뿐이다.
     */
    static class StubAuthWebUseCase implements AuthWebUseCase {

        private String receivedCookieState;
        private boolean failWithInvalidState;

        @Override
        public OAuthStateCookieResult<AuthOAuthAuthorizeResponse> generateOAuthAuthorizationUrl(OAuthProvider provider, OAuthSignupConsent consent) {
            return OAuthStateCookieResult.of(
                AuthOAuthAuthorizeResponse.builder().authorizationUrl("https://example.test/authorize?state=" + STATE).build(), STATE);
        }

        @Override
        public AuthCookieResult<AuthGeneralLoginResponse> oauthLogin(
            OAuthProvider provider, String authCode, String state, String cookieState
        ) {
            this.receivedCookieState = cookieState;
            if (failWithInvalidState) {
                throw new AuthException(AuthErrorCode.INVALID_OAUTH_STATE);
            }
            return AuthCookieResult.of(
                AuthGeneralLoginResponse.builder().accessToken("access").memberId("1").build(), "refresh-token");
        }

        @Override
        public AuthCookieResult<AuthGeneralLoginResponse> generalLogin(AuthGeneralLoginCommand command) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void logout(long memberId, String tokenId, String refreshToken) {
            throw new UnsupportedOperationException();
        }

        @Override
        public AuthSessionsResponse getMySessions(long memberId, String refreshToken) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void revokeSession(long memberId, String sessionId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public AuthCookieResult<TokenReissueResponse> reissueToken(TokenReissueCommand command) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void sendEmailVerificationCode(String email, String clientIp) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void sendPasswordResetCode(String email, String clientIp) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void resetPassword(String email, String code, String newPassword) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void verifyEmailVerificationCode(String email, String code) {
            throw new UnsupportedOperationException();
        }
    }
}

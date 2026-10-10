package com.hondigagae.domainlayer.auth.adapter.in.web.controller;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthCodeSendResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthGeneralLoginResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthOAuthAuthorizeResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthSessionsResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.TokenReissueResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.presenter.AuthPresenter;
import com.hondigagae.domainlayer.auth.adapter.in.web.provider.OAuthStateCookieProvider;
import com.hondigagae.domainlayer.auth.adapter.in.web.provider.RefreshCookieProvider;
import com.hondigagae.domainlayer.auth.adapter.in.web.support.ClientIpResolver;
import com.hondigagae.domainlayer.auth.application.command.AuthGeneralLoginCommand;
import com.hondigagae.domainlayer.auth.application.command.TokenReissueCommand;
import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.info.AuthCookieResult;
import com.hondigagae.domainlayer.auth.application.info.OAuthStateCookieResult;
import com.hondigagae.domainlayer.auth.application.info.VerificationCodeSendInfo;
import com.hondigagae.domainlayer.auth.application.model.OAuthSignupConsent;
import com.hondigagae.domainlayer.auth.application.port.in.AuthWebUseCase;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.security.auth.config.AuthSecurityConfigurer;
import com.hondigagae.security.auth.config.JwtAuthPropertiesConfig;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 인증코드 발송 응답 값과 429 {@code Retry-After} 헤더를 실제 MVC 경로(컨트롤러 + {@code AuthExceptionHandler})로 고정한다 (#1293).
 *
 * <p>프로세서 테스트는 "어떤 값을 만드는가" 까지만 본다. 여기서 보는 것은 그 값이 <b>와이어에 어떤 모양으로
 * 실리는가</b>다 — dataBody 의 두 필드, 헤더 이름 · 정수 초 형식, 그리고 헤더를 달아도 오류 봉투 · 코드 ·
 * 상태가 그대로인지.
 */
@WebMvcTest(controllers = AuthWebController.class)
@Import({
    AuthSecurityConfigurer.class, JwtAuthPropertiesConfig.class,
    RefreshCookieProvider.class, OAuthStateCookieProvider.class, ClientIpResolver.class,
    AuthCodeTimingWebTest.StubUseCaseConfig.class
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
class AuthCodeTimingWebTest {

    private static final String EMAIL_BODY = "{\"email\":\"user@example.com\"}";
    private static final String LOGIN_BODY = "{\"email\":\"user@example.com\",\"password\":\"P@ssw0rd!\"}";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StubAuthWebUseCase useCase;

    @BeforeEach
    void resetStub() {
        useCase.failure = null;
    }

    @Test
    @DisplayName("회원가입 인증코드 발송 응답 dataBody 에 코드 TTL · 재발송 대기 시간(초)이 실린다")
    void emailSendCodeReturnsTiming() throws Exception {
        mockMvc.perform(post("/api/v1/auth/email/send-code").contentType(MediaType.APPLICATION_JSON).content(EMAIL_BODY))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dataHeader.success").value(true))
            .andExpect(jsonPath("$.dataBody.codeExpiresInSeconds").value(300))
            .andExpect(jsonPath("$.dataBody.resendAvailableInSeconds").value(60))
            .andExpect(header().doesNotExist(HttpHeaders.RETRY_AFTER));
    }

    @Test
    @DisplayName("비밀번호 재설정 코드 발송 응답도 같은 모양 · 같은 값이다")
    void passwordResetSendCodeReturnsTiming() throws Exception {
        mockMvc.perform(post("/api/v1/auth/password/reset/send-code").contentType(MediaType.APPLICATION_JSON).content(EMAIL_BODY))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dataBody.codeExpiresInSeconds").value(300))
            .andExpect(jsonPath("$.dataBody.resendAvailableInSeconds").value(60));
    }

    @Test
    @DisplayName("쿨다운 429(AUTH_003)는 Retry-After 를 달고, 봉투 · 코드 · 상태는 그대로다")
    void cooldownCarriesRetryAfterHeader() throws Exception {
        useCase.failure = AuthException.withRetryAfter(AuthErrorCode.EMAIL_CODE_COOLDOWN, 43L);

        mockMvc.perform(post("/api/v1/auth/email/send-code").contentType(MediaType.APPLICATION_JSON).content(EMAIL_BODY))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().string(HttpHeaders.RETRY_AFTER, "43"))
            .andExpect(jsonPath("$.dataHeader.success").value(false))
            .andExpect(jsonPath("$.dataHeader.resultCode").value("AUTH_003"))
            .andExpect(jsonPath("$.dataHeader.resultMessage").value(AuthErrorCode.EMAIL_CODE_COOLDOWN.getMessage()))
            .andExpect(jsonPath("$.dataBody").value(nullValue()));
    }

    @Test
    @DisplayName("IP 상한 429(AUTH_016)도 Retry-After 를 단다")
    void ipLimitCarriesRetryAfterHeader() throws Exception {
        useCase.failure = AuthException.withRetryAfter(AuthErrorCode.EMAIL_SEND_IP_LIMITED, 3600L);

        mockMvc.perform(post("/api/v1/auth/password/reset/send-code").contentType(MediaType.APPLICATION_JSON).content(EMAIL_BODY))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().string(HttpHeaders.RETRY_AFTER, "3600"))
            .andExpect(jsonPath("$.dataHeader.resultCode").value("AUTH_016"));
    }

    @Test
    @DisplayName("로그인 잠금 429(AUTH_015)도 Retry-After 를 단다")
    void loginLockCarriesRetryAfterHeader() throws Exception {
        useCase.failure = AuthException.withRetryAfter(AuthErrorCode.LOGIN_ATTEMPT_LOCKED, 541L);

        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().string(HttpHeaders.RETRY_AFTER, "541"))
            .andExpect(jsonPath("$.dataHeader.resultCode").value("AUTH_015"));
    }

    @Test
    @DisplayName("재시도 시각이 없는 오류에는 Retry-After 를 달지 않는다")
    void plainAuthErrorHasNoRetryAfter() throws Exception {
        useCase.failure = new AuthException(AuthErrorCode.LOGIN_FAILED);

        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
            .andExpect(status().isUnauthorized())
            .andExpect(header().doesNotExist(HttpHeaders.RETRY_AFTER))
            .andExpect(jsonPath("$.dataHeader.resultCode").value("AUTH_006"));
    }

    @TestConfiguration
    static class StubUseCaseConfig {

        @Bean
        StubAuthWebUseCase stubAuthWebUseCase() {
            return new StubAuthWebUseCase();
        }
    }

    /**
     * 발송 응답은 실제 Presenter 로 만든다 — 스텁이 DTO 를 직접 꾸미면 초 변환이 검증되지 않는다.
     */
    static class StubAuthWebUseCase implements AuthWebUseCase {

        private static final VerificationCodeSendInfo SEND_INFO = VerificationCodeSendInfo.of(Duration.ofMinutes(5), Duration.ofSeconds(60));

        private final AuthPresenter presenter = new AuthPresenter();
        private AuthException failure;

        private void failIfConfigured() {
            if (failure != null) {
                throw failure;
            }
        }

        @Override
        public AuthCodeSendResponse sendEmailVerificationCode(String email, String clientIp) {
            failIfConfigured();
            return presenter.toCodeSendResponse(SEND_INFO);
        }

        @Override
        public AuthCodeSendResponse sendPasswordResetCode(String email, String clientIp) {
            failIfConfigured();
            return presenter.toCodeSendResponse(SEND_INFO);
        }

        @Override
        public AuthCookieResult<AuthGeneralLoginResponse> generalLogin(AuthGeneralLoginCommand command) {
            failIfConfigured();
            return AuthCookieResult.of(AuthGeneralLoginResponse.builder().accessToken("access").memberId("1").build(), "refresh-token");
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
        public void resetPassword(String email, String code, String newPassword) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void verifyEmailVerificationCode(String email, String code) {
            throw new UnsupportedOperationException();
        }

        @Override
        public OAuthStateCookieResult<AuthOAuthAuthorizeResponse> generateOAuthAuthorizationUrl(OAuthProvider provider, OAuthSignupConsent consent) {
            throw new UnsupportedOperationException();
        }

        @Override
        public AuthCookieResult<AuthGeneralLoginResponse> oauthLogin(OAuthProvider provider, String authCode, String state, String cookieState) {
            throw new UnsupportedOperationException();
        }
    }
}

package com.hondigagae.domainlayer.auth.adapter.in.web.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthGeneralLoginResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthOAuthAuthorizeResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthSessionsResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthVerificationCodeSendResponse;
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
 * 인증코드 발송 응답의 시간 정보와 429 의 {@code Retry-After} 헤더를 실제 MVC 경로로 고정한다 (#1293).
 *
 * <p>프로세서 테스트는 "어떤 {@code Duration} 을 예외에 싣는가"까지만 본다. 여기서 보는 것은 그 값이
 * <b>예외 핸들러를 거쳐 헤더로 나가는가</b>, 초 단위 변환이 올림인가, 그리고 본문 봉투 · 코드 · 상태가
 * 그대로인가다. 헤더를 {@code ResponseEntity} 에서 달면 예외로 끝나는 429 에는 실리지 않는다.
 */
@WebMvcTest(controllers = AuthWebController.class)
@Import({
    AuthSecurityConfigurer.class, JwtAuthPropertiesConfig.class,
    RefreshCookieProvider.class, OAuthStateCookieProvider.class, ClientIpResolver.class,
    AuthRetryTimingFlowTest.StubUseCaseConfig.class
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
class AuthRetryTimingFlowTest {

    private static final String EMAIL_BODY = "{\"email\":\"user@example.com\"}";
    private static final String LOGIN_BODY = "{\"email\":\"user@example.com\",\"password\":\"P@ssw0rd!\"}";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StubAuthWebUseCase useCase;

    @BeforeEach
    void resetStub() {
        // 스텁은 컨텍스트에 붙은 싱글턴이라 테스트 간에 상태가 넘어간다.
        useCase.failure = null;
    }

    @Test
    @DisplayName("회원가입 인증코드 발송 응답에 코드 유효 시간과 재발송 대기 시간이 초 단위로 실린다")
    void emailSendCodeCarriesTiming() throws Exception {
        mockMvc.perform(post("/api/v1/auth/email/send-code").contentType(MediaType.APPLICATION_JSON).content(EMAIL_BODY))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dataHeader.success").value(true))
            .andExpect(jsonPath("$.dataBody.codeExpiresInSeconds").value(300))
            .andExpect(jsonPath("$.dataBody.resendAvailableInSeconds").value(60))
            .andExpect(header().doesNotExist(HttpHeaders.RETRY_AFTER));
    }

    @Test
    @DisplayName("비밀번호 재설정 코드 발송 응답도 같은 모양이다")
    void passwordResetSendCodeCarriesTiming() throws Exception {
        mockMvc.perform(post("/api/v1/auth/password/reset/send-code").contentType(MediaType.APPLICATION_JSON).content(EMAIL_BODY))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dataBody.codeExpiresInSeconds").value(300))
            .andExpect(jsonPath("$.dataBody.resendAvailableInSeconds").value(60));
    }

    @Test
    @DisplayName("쿨다운 429(AUTH_003)는 남은 시간을 초로 올림해 Retry-After 에 싣고 본문 봉투는 그대로다")
    void cooldownCarriesRetryAfterRoundedUp() throws Exception {
        useCase.failure = AuthException.withRetryAfter(AuthErrorCode.EMAIL_CODE_COOLDOWN, Duration.ofMillis(41_200));

        mockMvc.perform(post("/api/v1/auth/email/send-code").contentType(MediaType.APPLICATION_JSON).content(EMAIL_BODY))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().string(HttpHeaders.RETRY_AFTER, "42"))
            .andExpect(jsonPath("$.dataHeader.success").value(false))
            .andExpect(jsonPath("$.dataHeader.resultCode").value(AuthErrorCode.EMAIL_CODE_COOLDOWN.getCode()))
            .andExpect(jsonPath("$.dataHeader.resultMessage").value(AuthErrorCode.EMAIL_CODE_COOLDOWN.getMessage()));
    }

    @Test
    @DisplayName("IP 발송 상한 429(AUTH_016)도 Retry-After 를 싣는다")
    void ipLimitCarriesRetryAfter() throws Exception {
        useCase.failure = AuthException.withRetryAfter(AuthErrorCode.EMAIL_SEND_IP_LIMITED, Duration.ofSeconds(1_800));

        mockMvc.perform(post("/api/v1/auth/password/reset/send-code").contentType(MediaType.APPLICATION_JSON).content(EMAIL_BODY))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().string(HttpHeaders.RETRY_AFTER, "1800"))
            .andExpect(jsonPath("$.dataHeader.resultCode").value(AuthErrorCode.EMAIL_SEND_IP_LIMITED.getCode()));
    }

    @Test
    @DisplayName("로그인 잠금 429(AUTH_015)도 Retry-After 를 싣는다")
    void loginLockCarriesRetryAfter() throws Exception {
        useCase.failure = AuthException.withRetryAfter(AuthErrorCode.LOGIN_ATTEMPT_LOCKED, Duration.ofMinutes(10));

        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().string(HttpHeaders.RETRY_AFTER, "600"))
            .andExpect(jsonPath("$.dataHeader.resultCode").value(AuthErrorCode.LOGIN_ATTEMPT_LOCKED.getCode()));
    }

    @Test
    @DisplayName("1초 미만이 남아도 Retry-After 는 0 이 아니라 1 이다")
    void subSecondRemainderIsAtLeastOne() throws Exception {
        // 0 은 "지금 바로 다시 보내라"로 읽히고, 그 요청은 아직 살아 있는 키에 걸려 다시 429 가 된다.
        useCase.failure = AuthException.withRetryAfter(AuthErrorCode.EMAIL_CODE_COOLDOWN, Duration.ofMillis(300));

        mockMvc.perform(post("/api/v1/auth/email/send-code").contentType(MediaType.APPLICATION_JSON).content(EMAIL_BODY))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().string(HttpHeaders.RETRY_AFTER, "1"));
    }

    @Test
    @DisplayName("대기 시간이 없는 인증 오류에는 Retry-After 가 붙지 않는다")
    void otherAuthErrorsHaveNoRetryAfter() throws Exception {
        useCase.failure = new AuthException(AuthErrorCode.LOGIN_FAILED);

        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
            .andExpect(status().isUnauthorized())
            .andExpect(header().doesNotExist(HttpHeaders.RETRY_AFTER))
            .andExpect(jsonPath("$.dataHeader.resultCode").value(AuthErrorCode.LOGIN_FAILED.getCode()));
    }

    @TestConfiguration
    static class StubUseCaseConfig {

        @Bean
        StubAuthWebUseCase stubAuthWebUseCase() {
            return new StubAuthWebUseCase();
        }
    }

    /** 유스케이스는 손수 만든 스텁이다 — 보는 것은 컨트롤러 · 예외 핸들러가 무엇을 응답에 싣는가뿐이다. */
    static class StubAuthWebUseCase implements AuthWebUseCase {

        private static final AuthVerificationCodeSendResponse SEND_RESPONSE = AuthVerificationCodeSendResponse.builder()
            .codeExpiresInSeconds(300)
            .resendAvailableInSeconds(60)
            .build();

        private AuthException failure;

        @Override
        public AuthVerificationCodeSendResponse sendEmailVerificationCode(String email, String clientIp) {
            throwIfConfigured();
            return SEND_RESPONSE;
        }

        @Override
        public AuthVerificationCodeSendResponse sendPasswordResetCode(String email, String clientIp) {
            throwIfConfigured();
            return SEND_RESPONSE;
        }

        @Override
        public AuthCookieResult<AuthGeneralLoginResponse> generalLogin(AuthGeneralLoginCommand command) {
            throwIfConfigured();
            return AuthCookieResult.of(AuthGeneralLoginResponse.builder().accessToken("access").memberId("1").build(), "refresh-token");
        }

        private void throwIfConfigured() {
            if (failure != null) {
                throw failure;
            }
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

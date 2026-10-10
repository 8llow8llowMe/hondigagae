package com.hondigagae.security.auth.jwt;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.security.auth.blacklist.AccessTokenBlacklistVerifier;
import com.hondigagae.security.auth.handler.JwtAuthenticationFailureHandler;
import com.hondigagae.security.common.dto.MemberLoginActive;
import com.hondigagae.security.common.enums.SecurityRole;
import com.hondigagae.security.common.handler.DefaultSecurityErrorResponseWriter;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * 필터가 파싱 실패를 <b>응답으로 끝내는지</b> 고정한다 — 이슈 #214 의 재현 토큰이 500 이 아니라 401 JSON 이어야 한다.
 * 어떤 코드로 나뉘는지는 {@link JwtAuthProviderTest} 가, 그 코드가 봉투 안에서 401 로 나가는지는 여기서 본다.
 */
class JwtAuthFilterTest {

    private static final String ACCESS_KEY = "hondigagae-test-jwt-access-key-0123456789abcdef0123456789abcdef0123456789abcdef";
    private static final String REFRESH_KEY = "hondigagae-test-jwt-refresh-key-0123456789abcdef0123456789abcdef0123456789abcdef";
    /** 이슈 #214 재현 토큰 — 서명부가 base64url 로 디코딩할 수 없는 길이(1글자) */
    private static final String ONE_CHAR_SIGNATURE_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.x";

    private final JwtAuthProvider provider = new JwtAuthProvider(
        new JwtAuthProperties(ACCESS_KEY, Duration.ofMinutes(30), REFRESH_KEY, Duration.ofDays(14)));
    private final JwtAuthenticationFailureHandler failureHandler =
        new JwtAuthenticationFailureHandler(new DefaultSecurityErrorResponseWriter(new ObjectMapper()));

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("디코딩 불가 서명 토큰은 401 JSON 으로 끝나고 체인을 타지 않는다 — 500 으로 새던 갈래 (#214)")
    void undecodableSignatureEndsWith401() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter(null).doFilter(requestWithBearer(ONE_CHAR_SIGNATURE_TOKEN), response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getContentAsString()).contains("SECURITY_003");
        assertThat(chain.getRequest()).as("실패 응답을 썼으면 컨트롤러까지 가지 않는다").isNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    @DisplayName("서명이 다른 토큰은 401 SECURITY_004")
    void wrongSignatureEndsWith401() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter(null).doFilter(requestWithBearer("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.AAAA"), response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("SECURITY_004");
    }

    @Test
    @DisplayName("정상 토큰은 인증 주체를 세우고 체인을 계속 탄다")
    void validTokenAuthenticates() throws Exception {
        String token = provider.issueAccessToken(42L, SecurityRole.USER);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter(tokenId -> false).doFilter(requestWithBearer(token), response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();
        MemberLoginActive principal = (MemberLoginActive) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assertThat(principal.memberId()).isEqualTo(42L);
    }

    @Test
    @DisplayName("로그아웃(블랙리스트)된 토큰은 401 SECURITY_007")
    void revokedTokenEndsWith401() throws Exception {
        String token = provider.issueAccessToken(42L, SecurityRole.USER);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter(tokenId -> true).doFilter(requestWithBearer(token), response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("SECURITY_007");
    }

    @Test
    @DisplayName("Authorization 헤더가 없으면 손대지 않고 통과시킨다 — 인증 필요 여부는 @PreAuthorize 와 진입점의 몫")
    void noHeaderPassesThrough() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter(null).doFilter(new MockHttpServletRequest("GET", "/api/v1/members/me"), response, chain);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    private JwtAuthFilter filter(AccessTokenBlacklistVerifier blacklistVerifier) {
        return new JwtAuthFilter(provider, failureHandler, blacklistVerifier);
    }

    private static MockHttpServletRequest requestWithBearer(String token) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/members/me");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        return request;
    }
}

package com.hondigagae.domainlayer.auth.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthLoginResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthOAuthAuthorizeResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.TokenReissueResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.provider.RefreshCookieProvider;
import com.hondigagae.domainlayer.auth.application.command.TokenReissueCommand;
import com.hondigagae.domainlayer.auth.application.info.AuthCookieResult;
import com.hondigagae.domainlayer.auth.application.port.in.AuthWebUseCase;
import com.hondigagae.security.common.dto.MemberLoginActive;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/auth")
@Tag(name = "인증/인가", description = "카카오 로그인, 로그아웃, 토큰 재발급 API를 제공합니다.")
public class AuthWebController {

    private static final String REFRESH_TOKEN_COOKIE = "refreshToken";

    private final AuthWebUseCase authWebUseCase;
    private final RefreshCookieProvider refreshCookieProvider;

    @Operation(summary = "카카오 로그인 인가 URL 생성",
        description = "카카오 인가 페이지 URL을 생성합니다. CSRF 방어용 state가 포함되며 10분간 유효합니다. 프론트는 이 URL로 리다이렉트합니다.")
    @GetMapping("/kakao/authorize")
    public ResponseEntity<Response<AuthOAuthAuthorizeResponse>> generateKakaoAuthorizationUrl() {
        AuthOAuthAuthorizeResponse response = authWebUseCase.generateKakaoAuthorizationUrl();
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "카카오 로그인",
        description = "카카오 콜백의 인가코드와 state로 로그인합니다. 미가입 카카오 계정이면 자동 회원가입 후 로그인합니다. accessToken과 refresh 쿠키를 발급합니다.")
    @GetMapping("/kakao/login")
    public ResponseEntity<Response<AuthLoginResponse>> loginWithKakaoCode(
        @Parameter(description = "카카오가 콜백으로 전달한 인가코드", required = true) @RequestParam("code") String code,
        @Parameter(description = "인가 URL 생성 시 발급된 state", required = true) @RequestParam("state") String state
    ) {
        AuthCookieResult<AuthLoginResponse> result = authWebUseCase.kakaoLogin(code, state);
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookieProvider.createRefreshCookie(result.refreshToken()).toString())
            .body(Response.success(result.response()));
    }

    @Operation(summary = "토큰 재발급", description = "리프레시 토큰으로 Access Token을 재발급합니다.")
    @PostMapping("/token/reissue")
    public ResponseEntity<Response<TokenReissueResponse>> reissueToken(
        @CookieValue(name = REFRESH_TOKEN_COOKIE, required = false) String refreshToken) {
        AuthCookieResult<TokenReissueResponse> result = authWebUseCase.reissueToken(TokenReissueCommand.from(refreshToken));
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookieProvider.createRefreshCookie(result.refreshToken()).toString())
            .body(Response.success(result.response()));
    }

    @Operation(summary = "로그아웃", description = "로그아웃하고 리프레시 토큰을 무효화합니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PostMapping("/logout")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> logout(@AuthenticationPrincipal MemberLoginActive loginActive) {
        authWebUseCase.logout(loginActive.memberId(), loginActive.tokenId());
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookieProvider.clearRefreshCookie().toString())
            .body(Response.success());
    }
}

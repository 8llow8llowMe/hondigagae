package com.hondigagae.domainlayer.auth.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.request.AuthEmailCodeSendRequest;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.request.AuthEmailCodeVerifyRequest;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.request.AuthGeneralLoginRequest;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthGeneralLoginResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthOAuthAuthorizeResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.TokenReissueResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.provider.RefreshCookieProvider;
import com.hondigagae.domainlayer.auth.adapter.in.web.support.ClientIpResolver;
import com.hondigagae.domainlayer.auth.application.command.AuthGeneralLoginCommand;
import com.hondigagae.domainlayer.auth.application.command.TokenReissueCommand;
import com.hondigagae.domainlayer.auth.application.info.AuthCookieResult;
import com.hondigagae.domainlayer.auth.application.port.in.AuthWebUseCase;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.security.common.dto.MemberLoginActive;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/auth")
@Tag(name = "인증/인가", description = "로그인, 로그아웃, 토큰 재발급 API를 제공합니다.")
public class AuthWebController {

    private static final String REFRESH_TOKEN_COOKIE = "refreshToken";

    private final AuthWebUseCase authWebUseCase;
    private final RefreshCookieProvider refreshCookieProvider;
    private final ClientIpResolver clientIpResolver;

    @Operation(
        summary = "일반 로그인",
        description = "이메일과 비밀번호로 로그인합니다. 형식 오류는 400(필드별 검증 코드), 자격증명 불일치는 401(AUTH_006)로 "
            + "구분됩니다. 실패가 누적되면 해당 이메일이 일정 시간 잠깁니다(AUTH_015, 429)."
    )
    @PostMapping("/login")
    public ResponseEntity<Response<AuthGeneralLoginResponse>> loginWithCredentials(@Valid @RequestBody AuthGeneralLoginRequest request) {
        AuthCookieResult<AuthGeneralLoginResponse> result = authWebUseCase.generalLogin(AuthGeneralLoginCommand.from(request));
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookieProvider.createRefreshCookie(result.refreshToken()).toString())
            .body(Response.success(result.response()));
    }

    @Operation(
        summary = "로그아웃",
        description = "현재 기기의 세션만 로그아웃합니다 (리프레시 토큰 무효화 + Access 토큰 블랙리스트). 다른 기기의 로그인은 유지됩니다.",
        security = {@SecurityRequirement(name = "bearerAuth")}
    )
    @PostMapping("/logout")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> logout(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @CookieValue(name = REFRESH_TOKEN_COOKIE, required = false) String refreshToken
    ) {
        authWebUseCase.logout(loginActive.memberId(), loginActive.tokenId(), refreshToken);
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookieProvider.clearRefreshCookie().toString())
            .body(Response.success());
    }

    @Operation(summary = "소셜 로그인 인가 URL 생성", description = "provider(kakao/naver) 인가 페이지 URL을 생성합니다. CSRF 방어용 state가 포함되며 10분간 유효합니다. 프론트는 이 URL로 리다이렉트합니다.")
    @GetMapping("/{provider}/authorize")
    public ResponseEntity<Response<AuthOAuthAuthorizeResponse>> generateOAuthAuthorizationUrl(
        @Parameter(description = "소셜 로그인 제공자", required = true, example = "kakao") @PathVariable OAuthProvider provider
    ) {
        AuthOAuthAuthorizeResponse response = authWebUseCase.generateOAuthAuthorizationUrl(provider);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "소셜 로그인", description = "provider 콜백의 인가코드와 state로 로그인합니다. 미가입 이메일이면 자동 회원가입 후 로그인합니다. 응답은 일반 로그인과 동일합니다(accessToken + refresh 쿠키).")
    @GetMapping("/{provider}/login")
    public ResponseEntity<Response<AuthGeneralLoginResponse>> loginWithOAuthCode(
        @Parameter(description = "소셜 로그인 제공자", required = true, example = "kakao") @PathVariable OAuthProvider provider,
        @Parameter(description = "provider가 콜백으로 전달한 인가코드", required = true) @RequestParam("code") String code,
        @Parameter(description = "인가 URL 생성 시 발급된 state", required = true) @RequestParam("state") String state
    ) {
        AuthCookieResult<AuthGeneralLoginResponse> result = authWebUseCase.oauthLogin(provider, code, state);
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookieProvider.createRefreshCookie(result.refreshToken()).toString())
            .body(Response.success(result.response()));
    }

    @Operation(summary = "이메일 인증코드 발송", description = "회원가입용 이메일 인증코드를 발송합니다. 이메일당 60초 쿨다운(AUTH_003)과 IP당 시간당 발송 상한(AUTH_016)이 적용되며, 가입 여부와 무관하게 항상 성공으로 응답합니다(기가입 이메일에는 안내 메일 발송).")
    @PostMapping("/email/send-code")
    public ResponseEntity<Response<Void>> sendEmailVerificationCode(
        @Valid @RequestBody AuthEmailCodeSendRequest request,
        HttpServletRequest httpServletRequest
    ) {
        authWebUseCase.sendEmailVerificationCode(request.email(), clientIpResolver.resolve(httpServletRequest));
        return ResponseEntity.ok().body(Response.success());
    }

    @Operation(summary = "이메일 인증코드 검증", description = "메일로 받은 인증코드를 검증합니다. 성공하면 30분 동안 해당 이메일로 회원가입할 수 있습니다.")
    @PostMapping("/email/verify-code")
    public ResponseEntity<Response<Void>> verifyEmailVerificationCode(@Valid @RequestBody AuthEmailCodeVerifyRequest request) {
        authWebUseCase.verifyEmailVerificationCode(request.email(), request.code());
        return ResponseEntity.ok().body(Response.success());
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
}

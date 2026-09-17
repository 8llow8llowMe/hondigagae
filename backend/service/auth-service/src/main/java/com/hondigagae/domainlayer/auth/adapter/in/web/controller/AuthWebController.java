package com.hondigagae.domainlayer.auth.adapter.in.web.controller;

import org.springframework.web.bind.annotation.DeleteMapping;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthSessionsResponse;
import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.request.AuthEmailCodeSendRequest;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.request.AuthEmailCodeVerifyRequest;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.request.AuthGeneralLoginRequest;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.request.AuthPasswordResetCodeSendRequest;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.request.AuthPasswordResetRequest;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthGeneralLoginResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthOAuthAuthorizeResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.TokenReissueResponse;
import com.hondigagae.domainlayer.auth.adapter.in.web.provider.RefreshCookieProvider;
import com.hondigagae.domainlayer.auth.adapter.in.web.support.ClientIpResolver;
import com.hondigagae.domainlayer.auth.application.command.AuthGeneralLoginCommand;
import com.hondigagae.domainlayer.auth.application.command.TokenReissueCommand;
import com.hondigagae.domainlayer.auth.application.info.AuthCookieResult;
import com.hondigagae.domainlayer.auth.application.model.OAuthSignupConsent;
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

    private final AuthWebUseCase authWebUseCase;
    private final RefreshCookieProvider refreshCookieProvider;
    private final ClientIpResolver clientIpResolver;

    @Operation(
        summary = "일반 로그인",
        description = "이메일과 비밀번호로 로그인합니다. 형식 오류는 400(필드별 검증 코드), 자격증명 불일치는 401(AUTH_006)로 "
            + "구분됩니다. 실패가 누적되면 해당 이메일이 일정 시간 잠깁니다(AUTH_015, 429).\n\n"
            + "인증 불필요. **필수: 요청 바디의 email, password.** "
            + "응답 바디의 accessToken 을 이후 요청의 `Authorization: Bearer` 헤더에 넣고, refresh 토큰은 HttpOnly 쿠키로 자동 저장됩니다.\n\n"
            + "호출 예: `POST /api/v1/auth/login` `{\"email\":\"user@example.com\",\"password\":\"P@ssw0rd!\"}`"
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
        description = "현재 기기의 세션만 로그아웃합니다 (리프레시 토큰 무효화 + Access 토큰 블랙리스트). 다른 기기의 로그인은 유지됩니다.\n\n"
            + "**필수: Authorization 헤더.** refresh 쿠키는 브라우저가 자동 전송하며 없어도 동작합니다.\n\n"
            + "호출 예: `POST /api/v1/auth/logout` (바디 없음)",
        security = {@SecurityRequirement(name = "bearerAuth")}
    )
    @PostMapping("/logout")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> logout(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[선택] refresh 토큰 쿠키. 로그인 응답의 Set-Cookie 로 심어지고 브라우저가 자동으로 보내므로 직접 넣지 않습니다")
        @CookieValue(name = RefreshCookieProvider.REFRESH_TOKEN_COOKIE, required = false) String refreshToken
    ) {
        authWebUseCase.logout(loginActive.memberId(), loginActive.tokenId(), refreshToken);
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookieProvider.clearRefreshCookie().toString())
            .body(Response.success());
    }

    @Operation(summary = "로그인 기기 목록",
        description = "현재 로그인된 기기(활성 refresh 세션) 목록을 최근 갱신순으로 조회합니다. "
            + "current 는 refresh 쿠키로 판별하므로 쿠키가 없는 요청에서는 모두 false 입니다. 기기당 별칭은 저장하지 않습니다.\n\n"
            + "**필수: Authorization 헤더.** 쿼리 파라미터는 없습니다.\n\n"
            + "호출 예: `GET /api/v1/auth/sessions`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/sessions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<AuthSessionsResponse>> getMySessions(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[선택] refresh 토큰 쿠키. 로그인 응답의 Set-Cookie 로 심어지고 브라우저가 자동으로 보내므로 직접 넣지 않습니다. 있으면 그 기기가 current=true 로 표시됩니다")
        @CookieValue(name = RefreshCookieProvider.REFRESH_TOKEN_COOKIE, required = false) String refreshToken
    ) {
        AuthSessionsResponse response = authWebUseCase.getMySessions(loginActive.memberId(), refreshToken);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "특정 기기 로그아웃",
        description = "지정한 세션(기기)의 refresh 토큰을 무효화합니다. 이미 만료된 세션이어도 성공합니다(멱등). "
            + "해당 기기가 이미 발급받은 access 토큰은 만료 시까지 유효할 수 있습니다.\n\n"
            + "**필수: Authorization 헤더, sessionId(경로).**\n\n"
            + "호출 예: `DELETE /api/v1/auth/sessions/3f2a9c11-0e4b-4a1f-9c3d-0b8e2f7a5d61`",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @DeleteMapping("/sessions/{sessionId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> revokeSession(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 세션 아이디(UUID). 기기 목록 조회 응답의 sessionId 를 그대로 씁니다", required = true,
            example = "3f2a9c11-0e4b-4a1f-9c3d-0b8e2f7a5d61") @PathVariable String sessionId
    ) {
        authWebUseCase.revokeSession(loginActive.memberId(), sessionId);
        return ResponseEntity.ok().body(Response.success());
    }

    @Operation(summary = "소셜 로그인 인가 URL 생성",
        description = "provider(kakao/naver) 인가 페이지 URL을 생성합니다. CSRF 방어용 state가 포함되며 10분간 유효합니다. 프론트는 이 URL로 리다이렉트합니다.\n\n"
            + "인증 불필요. **필수: provider(경로).** 동의·확인 값(termsAgreed/privacyAgreed/ageOver14Confirmed)은 선택이며 기본 false 입니다.\n\n"
            + "**신규 가입이면 세 값이 모두 필수입니다.** 이 값들은 state 와 함께 보관됐다가 최초 연동(= 신규 가입) 때만 쓰이고, "
            + "이미 가입한 회원의 로그인에는 영향을 주지 않습니다. 빠진 채로 최초 연동을 시도하면 콜백(소셜 로그인)에서 "
            + "문서 동의 누락은 `MEMBER_010`, 만 14세 이상 확인 누락은 `MEMBER_011` 로 거부됩니다 — 프론트가 강조할 체크박스가 달라 코드를 나눴습니다. "
            + "인가코드가 1회용이라 콜백에서 다시 받을 수 없어 이 단계에서 받습니다.\n\n"
            + "호출 예: `GET /api/v1/auth/kakao/authorize?termsAgreed=true&privacyAgreed=true&ageOver14Confirmed=true` "
            + "→ 응답의 authorizeUrl 로 브라우저를 이동시킵니다")
    @GetMapping("/{provider}/authorize")
    public ResponseEntity<Response<AuthOAuthAuthorizeResponse>> generateOAuthAuthorizationUrl(
        @Parameter(description = "[필수] 소셜 로그인 제공자. kakao 카카오 · naver 네이버 (소문자)", required = true, example = "kakao") @PathVariable OAuthProvider provider,
        @Parameter(description = "[선택] 이용약관 동의 여부. 신규 가입이 되는 최초 연동에서만 필요하고, 이미 가입한 회원의 로그인에는 쓰이지 않습니다", example = "true")
        @RequestParam(defaultValue = "false") boolean termsAgreed,
        @Parameter(description = "[선택] 개인정보 처리방침 동의 여부. 신규 가입이 되는 최초 연동에서만 필요하고, 이미 가입한 회원의 로그인에는 쓰이지 않습니다", example = "true")
        @RequestParam(defaultValue = "false") boolean privacyAgreed,
        @Parameter(description = "[선택] 만 14세 이상 확인 여부. 신규 가입이 되는 최초 연동에서만 필요하고, 이미 가입한 회원의 로그인에는 쓰이지 않습니다", example = "true")
        @RequestParam(defaultValue = "false") boolean ageOver14Confirmed
    ) {
        AuthOAuthAuthorizeResponse response = authWebUseCase.generateOAuthAuthorizationUrl(
            provider, new OAuthSignupConsent(termsAgreed, privacyAgreed, ageOver14Confirmed));
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "소셜 로그인",
        description = "provider 콜백의 인가코드와 state로 로그인합니다. 미가입 이메일이면 자동 회원가입 후 로그인합니다. 응답은 일반 로그인과 동일합니다(accessToken + refresh 쿠키).\n\n"
            + "인증 불필요. **필수: provider(경로), code, state.** 둘 다 provider 가 콜백 URL 의 쿼리로 넘겨준 값을 그대로 전달합니다. "
            + "state 가 인가 URL 생성 때 발급한 값과 다르거나 10분이 지났으면 실패합니다.\n\n"
            + "자동 회원가입이 일어나는 최초 연동에서 인가 URL 생성 때 문서 동의를 받지 않았다면 `MEMBER_010`, "
            + "만 14세 이상 확인을 받지 않았다면 `MEMBER_011` 로 거부됩니다. "
            + "이미 가입한 회원의 로그인은 동의·확인과 무관하게 통과합니다.\n\n"
            + "호출 예: `GET /api/v1/auth/kakao/login?code=<콜백 code>&state=<콜백 state>`")
    @GetMapping("/{provider}/login")
    public ResponseEntity<Response<AuthGeneralLoginResponse>> loginWithOAuthCode(
        @Parameter(description = "[필수] 소셜 로그인 제공자. kakao 카카오 · naver 네이버 (소문자)", required = true, example = "kakao") @PathVariable OAuthProvider provider,
        @Parameter(description = "[필수] provider 가 콜백 URL 로 전달한 인가코드(1회용)", required = true, example = "q1w2e3r4t5y6u7i8o9p0") @RequestParam("code") String code,
        @Parameter(description = "[필수] 인가 URL 생성 응답에 들어 있던 state. 콜백 URL 의 state 를 그대로 넘깁니다", required = true, example = "3f2a9c11-0e4b-4a1f-9c3d-0b8e2f7a5d61") @RequestParam("state") String state
    ) {
        AuthCookieResult<AuthGeneralLoginResponse> result = authWebUseCase.oauthLogin(provider, code, state);
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookieProvider.createRefreshCookie(result.refreshToken()).toString())
            .body(Response.success(result.response()));
    }

    @Operation(summary = "이메일 인증코드 발송",
        description = "회원가입용 이메일 인증코드를 발송합니다. 이메일당 60초 쿨다운(AUTH_003)과 IP당 시간당 발송 상한(AUTH_016)이 적용되며, "
            + "가입 여부와 무관하게 항상 성공으로 응답합니다(기가입 이메일에는 안내 메일 발송).\n\n"
            + "인증 불필요. **필수: 요청 바디의 email.**\n\n"
            + "호출 예: `POST /api/v1/auth/email/send-code` `{\"email\":\"user@example.com\"}`")
    @PostMapping("/email/send-code")
    public ResponseEntity<Response<Void>> sendEmailVerificationCode(
        @Valid @RequestBody AuthEmailCodeSendRequest request,
        HttpServletRequest httpServletRequest
    ) {
        authWebUseCase.sendEmailVerificationCode(request.email(), clientIpResolver.resolve(httpServletRequest));
        return ResponseEntity.ok().body(Response.success());
    }

    @Operation(summary = "이메일 인증코드 검증",
        description = "메일로 받은 인증코드를 검증합니다. 성공하면 30분 동안 해당 이메일로 회원가입할 수 있습니다.\n\n"
            + "인증 불필요. **필수: 요청 바디의 email, code.**\n\n"
            + "호출 예: `POST /api/v1/auth/email/verify-code` `{\"email\":\"user@example.com\",\"code\":\"A3K7MP2X\"}`")
    @PostMapping("/email/verify-code")
    public ResponseEntity<Response<Void>> verifyEmailVerificationCode(@Valid @RequestBody AuthEmailCodeVerifyRequest request) {
        authWebUseCase.verifyEmailVerificationCode(request.email(), request.code());
        return ResponseEntity.ok().body(Response.success());
    }

    @Operation(summary = "비밀번호 재설정 코드 발송", description = """
        비밀번호 재설정 인증코드를 메일로 발송합니다. 일반(이메일+비밀번호) 계정 전용입니다.
        계정 존재 여부와 무관하게 항상 성공으로 응답하며, 미가입 이메일과 소셜 전용 계정에는
        각각 안내 메일이 발송됩니다. 이메일당 60초 쿨다운(AUTH_003)과 IP당 발송 상한(AUTH_016)이 적용됩니다.

        인증 불필요. **필수: 요청 바디의 email.**

        호출 예: `POST /api/v1/auth/password/reset/send-code` `{"email":"user@example.com"}`""")
    @PostMapping("/password/reset/send-code")
    public ResponseEntity<Response<Void>> sendPasswordResetCode(
        @Valid @RequestBody AuthPasswordResetCodeSendRequest request,
        HttpServletRequest httpServletRequest
    ) {
        authWebUseCase.sendPasswordResetCode(request.email(), clientIpResolver.resolve(httpServletRequest));
        return ResponseEntity.ok().body(Response.success());
    }

    @Operation(summary = "비밀번호 재설정", description = """
        메일로 받은 인증코드로 비밀번호를 재설정합니다. 성공 시 전 기기 세션이 무효화되어 재로그인이 필요합니다.
        코드 불일치는 AUTH_004, 만료/미발급은 AUTH_005, 5회 실패 시 코드가 무효화되고 AUTH_017 로 응답합니다.

        인증 불필요. **필수: 요청 바디의 email, code, newPassword** (영문자·숫자·특수문자 포함 8~20자).

        호출 예: `POST /api/v1/auth/password/reset` `{"email":"user@example.com","code":"A2B3C4D5","newPassword":"NewP@ss123!"}`""")
    @PostMapping("/password/reset")
    public ResponseEntity<Response<Void>> resetPassword(@Valid @RequestBody AuthPasswordResetRequest request) {
        authWebUseCase.resetPassword(request.email(), request.code(), request.newPassword());
        return ResponseEntity.ok().body(Response.success());
    }

    @Operation(summary = "토큰 재발급",
        description = "리프레시 토큰으로 Access Token을 재발급합니다. 응답의 accessToken 으로 교체하고, refresh 쿠키도 새 값으로 갱신됩니다.\n\n"
            + "**필수: refresh 토큰 쿠키.** Authorization 헤더와 바디는 필요 없습니다. "
            + "쿠키가 없거나 만료·무효화(로그아웃, 비밀번호 변경, 탈퇴)됐으면 401 이며 다시 로그인해야 합니다.\n\n"
            + "호출 예: `POST /api/v1/auth/token/reissue` (바디 없음, 쿠키 자동 전송)")
    @PostMapping("/token/reissue")
    public ResponseEntity<Response<TokenReissueResponse>> reissueToken(
        @Parameter(description = "[필수] refresh 토큰 쿠키. 로그인 응답의 Set-Cookie 로 심어지고 브라우저가 자동으로 보냅니다. 없으면 401", required = true)
        @CookieValue(name = RefreshCookieProvider.REFRESH_TOKEN_COOKIE, required = false) String refreshToken) {
        AuthCookieResult<TokenReissueResponse> result = authWebUseCase.reissueToken(TokenReissueCommand.from(refreshToken));
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookieProvider.createRefreshCookie(result.refreshToken()).toString())
            .body(Response.success(result.response()));
    }
}

package com.hondigagae.domainlayer.member.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.auth.adapter.in.web.provider.RefreshCookieProvider;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberMyInfoResponse;
import com.hondigagae.domainlayer.member.application.port.in.MemberWebUseCase;
import com.hondigagae.security.common.dto.MemberLoginActive;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/members")
@Tag(name = "회원", description = "내 정보 조회, 회원 탈퇴 API를 제공합니다.")
public class MemberWebController {

    private final MemberWebUseCase memberWebUseCase;
    private final RefreshCookieProvider refreshCookieProvider;

    @Operation(summary = "내 회원 정보 조회", description = "로그인한 회원의 내 정보를 조회합니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<MemberMyInfoResponse>> getMyInfo(@AuthenticationPrincipal MemberLoginActive loginActive) {
        MemberMyInfoResponse response = memberWebUseCase.getMyInfo(loginActive.memberId());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "회원 탈퇴",
        description = "회원을 탈퇴 처리합니다. 개인정보가 마스킹되고 모든 기기의 토큰 재발급이 차단됩니다. "
            + "동일 카카오 계정으로 재가입할 수 없습니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PostMapping("/me/withdraw")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> withdraw(@AuthenticationPrincipal MemberLoginActive loginActive) {
        memberWebUseCase.withdraw(loginActive.memberId(), loginActive.tokenId());
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookieProvider.clearRefreshCookie().toString())
            .body(Response.success());
    }
}

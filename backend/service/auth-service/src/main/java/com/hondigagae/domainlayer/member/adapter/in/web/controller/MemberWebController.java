package com.hondigagae.domainlayer.member.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.auth.adapter.in.web.provider.RefreshCookieProvider;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.request.MemberGeneralSignupRequest;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.request.MemberMyInfoUpdateRequest;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.request.MemberPasswordChangeRequest;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.request.MemberPasswordSetupRequest;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberMyInfoResponse;
import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberProfileImageUploadResponse;
import com.hondigagae.domainlayer.member.application.command.MemberGeneralSignupCommand;
import com.hondigagae.domainlayer.member.application.port.in.MemberWebUseCase;
import com.hondigagae.security.common.dto.MemberLoginActive;
import com.hondigagae.storage.support.MultipartFileSupport;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/members")
@Tag(name = "회원", description = "회원 가입, 내 정보 조회/수정, 비밀번호 변경, 탈퇴 API를 제공합니다.")
public class MemberWebController {

    private final MemberWebUseCase memberWebUseCase;
    private final RefreshCookieProvider refreshCookieProvider;

    @Operation(summary = "일반 회원가입",
        description = "일반 회원으로 가입합니다. 먼저 이메일 인증코드 발송·검증(`/api/v1/auth/email/*`)을 마쳐야 하고, 검증 후 30분 안에 가입해야 합니다.\n\n"
            + "인증 불필요. **필수: 요청 바디의 email, password(영문자·숫자·특수문자 포함 8~20자), name(10자 이내), nickname(10자 이내), "
            + "termsAgreed, privacyAgreed, ageOver14Confirmed(셋 다 true).**\n\n"
            + "체크박스 셋은 각각 다른 코드로 막힙니다 — 이용약관 `MEMBER_115`, 개인정보 처리방침 `MEMBER_116`, 만 14세 이상 확인 `MEMBER_117`.\n\n"
            + "호출 예: `POST /api/v1/members/signup` "
            + "`{\"email\":\"user@example.com\",\"password\":\"P@ssw0rd!\",\"name\":\"홍길동\",\"nickname\":\"길동짱\","
            + "\"termsAgreed\":true,\"privacyAgreed\":true,\"ageOver14Confirmed\":true}`")
    @PostMapping("/signup")
    public ResponseEntity<Response<Void>> generalSignup(@Valid @RequestBody MemberGeneralSignupRequest request) {
        memberWebUseCase.generalSignup(MemberGeneralSignupCommand.from(request));
        return ResponseEntity.ok().body(Response.success());
    }

    @Operation(
        summary = "내 회원 정보 조회",
        description = "로그인한 회원의 내 정보를 조회합니다.\n\n**필수: Authorization 헤더.** 파라미터는 없습니다.\n\n호출 예: `GET /api/v1/members/me`",
        security = {@SecurityRequirement(name = "bearerAuth")}
    )
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<MemberMyInfoResponse>> getMyInfo(@AuthenticationPrincipal MemberLoginActive loginActive) {
        MemberMyInfoResponse response = memberWebUseCase.getMyInfo(loginActive.memberId());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(
        summary = "내 회원 정보 수정",
        description = "닉네임을 수정합니다. 프로필 이미지는 이 API가 아니라 전용 업로드/삭제 API로 관리합니다.\n\n"
            + "**필수: Authorization 헤더, 요청 바디의 nickname(10자 이내).**\n\n"
            + "호출 예: `PATCH /api/v1/members/me` `{\"nickname\":\"길동짱\"}`",
        security = {@SecurityRequirement(name = "bearerAuth")}
    )
    @PatchMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<MemberMyInfoResponse>> updateMyInfo(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Valid @RequestBody MemberMyInfoUpdateRequest request
    ) {
        MemberMyInfoResponse response = memberWebUseCase.updateMyInfo(loginActive.memberId(), request.nickname());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(
        summary = "프로필 이미지 업로드",
        description = "프로필 이미지를 업로드해 즉시 반영합니다. jpg/png/gif/webp 만 허용하며 파일 내용(매직 바이트)으로 형식을 판정합니다. "
            + "기존 이미지가 있으면 교체 후 이전 파일은 삭제됩니다.\n\n"
            + "**필수: Authorization 헤더, multipart 필드 imageFile** (jpg/png/gif/webp, 5MB 이하).\n\n"
            + "호출 예: `POST /api/v1/members/me/profile-image` (multipart/form-data, `imageFile=@photo.jpg`)",
        security = {@SecurityRequirement(name = "bearerAuth")}
    )
    @PostMapping(value = "/me/profile-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<MemberProfileImageUploadResponse>> uploadProfileImage(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "[필수] 업로드할 이미지 파일. jpg/png/gif/webp, 5MB 이하. 확장자가 아니라 파일 내용으로 형식을 판정합니다") @RequestPart("imageFile") MultipartFile imageFile
    ) {
        MemberProfileImageUploadResponse response = memberWebUseCase.uploadProfileImage(
            loginActive.memberId(), MultipartFileSupport.toCommand(imageFile));
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(
        summary = "프로필 이미지 삭제",
        description = "프로필 이미지를 제거합니다. 저장된 파일도 함께 삭제됩니다.\n\n**필수: Authorization 헤더.**\n\n호출 예: `DELETE /api/v1/members/me/profile-image`",
        security = {@SecurityRequirement(name = "bearerAuth")}
    )
    @DeleteMapping("/me/profile-image")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<MemberMyInfoResponse>> removeProfileImage(
        @AuthenticationPrincipal MemberLoginActive loginActive
    ) {
        MemberMyInfoResponse response = memberWebUseCase.removeProfileImage(loginActive.memberId());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(
        summary = "비밀번호 변경",
        description = "현재 비밀번호 확인 후 새 비밀번호로 변경합니다. 변경 후 재로그인이 필요하며, 모든 기기의 토큰 재발급이 차단됩니다. (다른 기기의 기존 access token은 만료 시까지 유효할 수 있습니다)\n\n"
            + "**필수: Authorization 헤더, 요청 바디의 currentPassword, newPassword(영문자·숫자·특수문자 포함 8~20자).**\n\n"
            + "호출 예: `POST /api/v1/members/me/password` `{\"currentPassword\":\"P@ssw0rd!\",\"newPassword\":\"NewP@ss123!\"}`",
        security = {@SecurityRequirement(name = "bearerAuth")}
    )
    @PostMapping("/me/password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> changePassword(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Valid @RequestBody MemberPasswordChangeRequest request
    ) {
        memberWebUseCase.changePassword(
            loginActive.memberId(), loginActive.tokenId(), request.currentPassword(), request.newPassword());
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookieProvider.clearRefreshCookie().toString())
            .body(Response.success());
    }

    @Operation(
        summary = "소셜 전용 계정 전환 (비밀번호 제거)",
        description = "소셜 로그인이 연결된 계정의 비밀번호를 제거해 소셜 전용 계정으로 전환합니다. 전환 후 이메일 로그인은 불가하며, 모든 기기에서 로그아웃됩니다. 소셜이 연결되지 않은 일반 계정은 400(MEMBER_009), 이미 소셜 전용이면 400(MEMBER_007)으로 응답합니다.\n\n"
            + "**필수: Authorization 헤더.** 바디 없음.\n\n호출 예: `DELETE /api/v1/members/me/password`",
        security = {@SecurityRequirement(name = "bearerAuth")}
    )
    @DeleteMapping("/me/password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> removePassword(@AuthenticationPrincipal MemberLoginActive loginActive) {
        memberWebUseCase.removePassword(loginActive.memberId(), loginActive.tokenId());
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookieProvider.clearRefreshCookie().toString())
            .body(Response.success());
    }

    @Operation(
        summary = "비밀번호 최초 설정",
        description = "소셜 로그인으로 가입해 비밀번호가 없는 계정에 비밀번호를 설정합니다. 설정 후에는 이메일 로그인과 소셜 로그인 모두 사용할 수 있습니다. 이미 비밀번호가 있는 계정은 400(MEMBER_008)으로 응답합니다.\n\n"
            + "**필수: Authorization 헤더, 요청 바디의 newPassword(영문자·숫자·특수문자 포함 8~20자).**\n\n"
            + "호출 예: `POST /api/v1/members/me/password/setup` `{\"newPassword\":\"NewP@ss123!\"}`",
        security = {@SecurityRequirement(name = "bearerAuth")}
    )
    @PostMapping("/me/password/setup")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> setupPassword(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Valid @RequestBody MemberPasswordSetupRequest request
    ) {
        memberWebUseCase.setupPassword(loginActive.memberId(), request.newPassword());
        return ResponseEntity.ok().body(Response.success());
    }

    @Operation(
        summary = "회원 탈퇴",
        description = "회원을 탈퇴 처리합니다. 개인정보가 마스킹되고 모든 기기의 토큰 재발급이 차단됩니다. 동일 이메일로 재가입할 수 없습니다. (다른 기기의 기존 access token은 만료 시까지 유효할 수 있으나, 회원 상태 검사로 회원 API 접근은 차단됩니다)\n\n"
            + "**필수: Authorization 헤더.** 바디 없음. 되돌릴 수 없습니다.\n\n호출 예: `POST /api/v1/members/me/withdraw`",
        security = {@SecurityRequirement(name = "bearerAuth")}
    )
    @PostMapping("/me/withdraw")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> withdraw(@AuthenticationPrincipal MemberLoginActive loginActive) {
        memberWebUseCase.withdraw(loginActive.memberId(), loginActive.tokenId());
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookieProvider.clearRefreshCookie().toString())
            .body(Response.success());
    }
}

package com.hondigagae.domainlayer.pet.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.request.PetSaveRequest;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetResponse;
import com.hondigagae.domainlayer.pet.adapter.in.web.dto.response.PetsResponse;
import com.hondigagae.domainlayer.pet.application.port.in.PetWebUseCase;
import com.hondigagae.security.common.dto.MemberLoginActive;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/members/me/pets")
@Tag(name = "반려견", description = "반려견 프로필 등록/조회/수정/삭제 API를 제공합니다. AI 여행 설계의 핵심 입력입니다.")
public class PetWebController {

    private final PetWebUseCase petWebUseCase;

    @Operation(summary = "내 반려견 목록 조회", description = "로그인한 회원이 등록한 반려견 목록을 조회합니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PetsResponse>> getMyPets(@AuthenticationPrincipal MemberLoginActive loginActive) {
        PetsResponse response = petWebUseCase.getMyPets(loginActive.memberId());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "반려견 상세 조회", description = "반려견 프로필 상세를 조회합니다. 본인 소유가 아니면 404로 응답합니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/{petId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PetResponse>> getMyPet(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "반려견 아이디", required = true, example = "1234567890123456789") @PathVariable long petId
    ) {
        PetResponse response = petWebUseCase.getMyPet(loginActive.memberId(), petId);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "반려견 등록",
        description = "반려견 프로필을 등록합니다. 품종·크기·환경 민감도·활동 성향이 AI 여행 설계에 반영됩니다. 회원당 최대 5마리까지 등록할 수 있습니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PetResponse>> registerPet(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Valid @RequestBody PetSaveRequest request
    ) {
        PetResponse response = petWebUseCase.registerPet(loginActive.memberId(), request.toCommand());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "반려견 정보 수정", description = "반려견 프로필을 수정합니다. 본인 소유가 아니면 404로 응답합니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PutMapping("/{petId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<PetResponse>> updatePet(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "반려견 아이디", required = true, example = "1234567890123456789") @PathVariable long petId,
        @Valid @RequestBody PetSaveRequest request
    ) {
        PetResponse response = petWebUseCase.updatePet(loginActive.memberId(), petId, request.toCommand());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "반려견 삭제",
        description = "반려견 프로필을 삭제합니다. 기존 여행 일정이 참조하고 있어 소프트 삭제로 처리됩니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @DeleteMapping("/{petId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> deletePet(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "반려견 아이디", required = true, example = "1234567890123456789") @PathVariable long petId
    ) {
        petWebUseCase.deletePet(loginActive.memberId(), petId);
        return ResponseEntity.ok().body(Response.success());
    }
}

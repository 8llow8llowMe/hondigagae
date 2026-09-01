package com.hondigagae.domainlayer.favorite.adapter.in.web.controller;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.favorite.adapter.in.web.dto.response.FavoritePlacesResponse;
import com.hondigagae.domainlayer.favorite.adapter.in.web.dto.response.FavoriteStatusResponse;
import com.hondigagae.domainlayer.favorite.application.port.in.FavoriteWebUseCase;
import com.hondigagae.security.common.dto.MemberLoginActive;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/favorites/places")
@Tag(name = "장소 즐겨찾기", description = "마음에 든 장소를 저장/해제/조회합니다. AI 일정 생성의 '즐겨찾기 우선 반영'에 쓰입니다.")
public class FavoriteWebController {

    private final FavoriteWebUseCase favoriteWebUseCase;

    @Operation(summary = "내 즐겨찾기 목록",
        description = "저장한 장소를 최근 저장순으로 조회합니다. 장소 요약은 tour-service 에서 붙이며, "
            + "조회에 실패해도 placeId 목록은 내려갑니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<FavoritePlacesResponse>> getMyFavorites(
        @AuthenticationPrincipal MemberLoginActive loginActive
    ) {
        FavoritePlacesResponse response = favoriteWebUseCase.getMyFavorites(loginActive.memberId());
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "즐겨찾기 여부 확인",
        description = "장소 한 곳의 즐겨찾기 저장 여부를 확인합니다. 상세 화면의 토글 초기 상태용입니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @GetMapping("/{placeId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<FavoriteStatusResponse>> getFavoriteStatus(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "장소 아이디", required = true, example = "212481712381923328") @PathVariable long placeId
    ) {
        FavoriteStatusResponse response = favoriteWebUseCase.getFavoriteStatus(loginActive.memberId(), placeId);
        return ResponseEntity.ok().body(Response.success(response));
    }

    @Operation(summary = "즐겨찾기 저장",
        description = "장소를 즐겨찾기에 저장합니다. 이미 저장된 장소면 그대로 성공합니다(멱등). 회원당 최대 100곳까지 저장할 수 있습니다.",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @PostMapping("/{placeId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> addFavorite(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "장소 아이디", required = true, example = "212481712381923328") @PathVariable long placeId
    ) {
        favoriteWebUseCase.addFavorite(loginActive.memberId(), placeId);
        return ResponseEntity.ok().body(Response.success());
    }

    @Operation(summary = "즐겨찾기 해제",
        description = "장소를 즐겨찾기에서 제거합니다. 저장되어 있지 않아도 성공합니다(멱등).",
        security = {@SecurityRequirement(name = "bearerAuth")})
    @DeleteMapping("/{placeId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Response<Void>> removeFavorite(
        @AuthenticationPrincipal MemberLoginActive loginActive,
        @Parameter(description = "장소 아이디", required = true, example = "212481712381923328") @PathVariable long placeId
    ) {
        favoriteWebUseCase.removeFavorite(loginActive.memberId(), placeId);
        return ResponseEntity.ok().body(Response.success());
    }
}

package com.hondigagae.domainlayer.favorite.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "즐겨찾기 여부 응답 DTO")
public record FavoriteStatusResponse(

    @Schema(description = "장소 아이디", example = "212481712381923328")
    String placeId,

    @Schema(description = "즐겨찾기 저장 여부", example = "true")
    boolean favorited
) {

}

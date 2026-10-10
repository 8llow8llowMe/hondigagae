package com.hondigagae.domainlayer.favorite.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.favorite.adapter.in.web.dto.item.FavoritePlaceItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "내 즐겨찾기 장소 목록 응답 DTO")
public record FavoritePlacesResponse(

    @Schema(description = "즐겨찾기 목록 (최근 저장순)")
    List<FavoritePlaceItem> places,

    @Schema(description = "저장된 즐겨찾기 수", example = "12")
    int totalCount
) {

}

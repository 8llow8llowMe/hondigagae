package com.hondigagae.domainlayer.place.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.NearbyPlaceItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "주변 장소 검색 응답 DTO")
public record NearbyPlaceResponse(

    @Schema(description = "검색 결과 (가까운 순)")
    List<NearbyPlaceItem> places,

    @Schema(description = "결과 수", example = "8")
    int totalCount,

    @Schema(description = "검색 반경(m)", example = "5000")
    int radius
) {
}

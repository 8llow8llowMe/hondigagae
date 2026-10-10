package com.hondigagae.domainlayer.place.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "주변 장소 항목")
public record NearbyPlaceItem(

    @Schema(description = "장소 정보")
    PlaceItem place,

    @Schema(description = "검색 중심점으로부터의 거리(m)", example = "820")
    int distanceMeters
) {

}

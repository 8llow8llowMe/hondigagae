package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "비 오는 날 실내 대안 장소 DTO")
public record PlanAlternativePlaceItem(

    @Schema(description = "장소 아이디", example = "212481712381923328")
    String placeId,

    @Schema(description = "장소명", example = "제주현대미술관")
    String title,

    @Schema(description = "위도", example = "33.3608276172")
    double lat,

    @Schema(description = "경도", example = "126.7818122232")
    double lng,

    @Schema(description = "그날 기준 장소로부터의 거리(m)", example = "2340")
    int distanceMeters
) {
}

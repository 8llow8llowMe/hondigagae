package com.hondigagae.domainlayer.insight.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

/** 비 예보일 때 제안하는 실내 대안 장소. */
@Builder
@Schema(description = "실내 대안 장소 DTO")
public record AlternativePlaceItem(

    @Schema(description = "장소 아이디", example = "212481712381923328")
    String placeId,

    @Schema(description = "장소명", example = "제주현대미술관")
    String title,

    @Schema(description = "위도", example = "33.3608276172")
    double lat,

    @Schema(description = "경도", example = "126.7818122232")
    double lng,

    @Schema(description = "기준 장소로부터의 거리(m)", example = "2340")
    int distanceMeters,

    @Schema(description = "반려동물 동반 구분 metadata")
    CodeNameDescriptionMetadata petAllowanceType,

    @Schema(description = "동반 가능 크기 metadata")
    CodeNameDescriptionMetadata allowedPetSize
) {
}

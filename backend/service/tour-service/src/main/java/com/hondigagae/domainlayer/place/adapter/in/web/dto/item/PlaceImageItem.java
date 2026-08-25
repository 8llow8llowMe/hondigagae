package com.hondigagae.domainlayer.place.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "장소 추가 이미지")
public record PlaceImageItem(

    @Schema(description = "원본 이미지 URL")
    String originImgUrl,

    @Schema(description = "썸네일 이미지 URL")
    String smallImageUrl,

    @Schema(description = "이미지명", example = "제주_천지연폭포 (8)")
    String imgName,

    @Schema(description = "저작권 유형 (Type1/Type3 — 출처표기 의무)", example = "Type1")
    String cpyrhtDivCd
) {

}

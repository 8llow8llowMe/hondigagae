package com.hondigagae.domainlayer.place.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "장소 목록 항목")
public record PlaceItem(

    @Schema(description = "장소 아이디", example = "212481712381923328")
    String placeId,

    @Schema(description = "콘텐츠 타입 metadata")
    CodeNameDescriptionMetadata contentType,

    @Schema(description = "장소명", example = "가세오름")
    String title,

    @Schema(description = "주소", example = "제주특별자치도 서귀포시 표선면 가시리")
    String addr1,

    @Schema(description = "관광 시군구코드", example = "3")
    String sigunguCode,

    @Schema(description = "위도", example = "33.3608276172")
    Double lat,

    @Schema(description = "경도", example = "126.7818122232")
    Double lng,

    @Schema(description = "대표 이미지 원본 URL")
    String firstImage,

    @Schema(description = "대표 이미지 썸네일 URL")
    String firstImage2,

    @Schema(description = "반려동물 동반 구분 metadata")
    CodeNameDescriptionMetadata petAllowanceType,

    @Schema(description = "전화번호", example = "064-760-6331")
    String tel
) {

}

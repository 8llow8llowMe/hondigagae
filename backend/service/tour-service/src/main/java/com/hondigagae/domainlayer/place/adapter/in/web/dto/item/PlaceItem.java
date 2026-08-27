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

    @Schema(description = "입장 가능 반려동물 크기 metadata")
    CodeNameDescriptionMetadata allowedPetSize,

    @Schema(description = "입장 가능 체중 상한(kg). 원문에 숫자가 있을 때만 온다", example = "12", nullable = true)
    Integer maxPetWeightKg,

    @Schema(description = "전화번호", example = "064-760-6331")
    String tel,

    @Schema(description = "실내 여부. null 이면 원천에 정보가 없다", example = "true", nullable = true)
    Boolean indoor,

    @Schema(description = "원본 분류 (원천이 준 값 그대로)", example = "카페", nullable = true)
    String sourceCategory,

    @Schema(description = "정보 출처", example = "문화정보원")
    String sourceName
) {

}

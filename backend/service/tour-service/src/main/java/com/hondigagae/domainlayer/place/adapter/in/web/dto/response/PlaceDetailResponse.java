package com.hondigagae.domainlayer.place.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceImageItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceIntroItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlacePetInfoItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "장소 상세 응답")
public record PlaceDetailResponse(

    @Schema(description = "장소 아이디", example = "212481712381923328")
    String placeId,

    @Schema(description = "TourAPI 콘텐츠 아이디", example = "126439")
    String contentId,

    @Schema(description = "콘텐츠 타입 metadata")
    CodeNameDescriptionMetadata contentType,

    @Schema(description = "장소명", example = "천지연폭포")
    String title,

    @Schema(description = "주소", example = "제주특별자치도 서귀포시 천지동 667-7")
    String addr1,

    @Schema(description = "상세주소", example = "(중문동)")
    String addr2,

    @Schema(description = "우편번호", example = "63546")
    String zipcode,

    @Schema(description = "위도", example = "33.2526559999")
    Double lat,

    @Schema(description = "경도", example = "126.4184294967")
    Double lng,

    @Schema(description = "대표 이미지 원본 URL")
    String firstImage,

    @Schema(description = "대표 이미지 썸네일 URL")
    String firstImage2,

    @Schema(description = "저작권 유형 (Type1/Type3 — 출처표기 의무)", example = "Type1")
    String cpyrhtDivCd,

    @Schema(description = "전화번호")
    String tel,

    @Schema(description = "홈페이지 (HTML anchor 포함 원문)")
    String homepage,

    @Schema(description = "개요")
    String overview,

    @Schema(description = "반려동물 동반 콘텐츠 여부", example = "true")
    boolean petAvailable,

    @Schema(description = "반려동물 동반 구분 metadata")
    CodeNameDescriptionMetadata petAllowanceType,

    @Schema(description = "소개 정보 (없으면 null)")
    PlaceIntroItem intro,

    @Schema(description = "반려동물 동반 정보 (없으면 null)")
    PlacePetInfoItem petInfo,

    @Schema(description = "추가 이미지 목록")
    List<PlaceImageItem> images
) {

}

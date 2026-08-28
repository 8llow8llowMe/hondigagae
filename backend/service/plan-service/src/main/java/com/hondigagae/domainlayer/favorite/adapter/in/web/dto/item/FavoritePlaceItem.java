package com.hondigagae.domainlayer.favorite.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

/**
 * 즐겨찾기 목록 항목. 장소 요약(제목 등)은 tour-service 장애 시 null 일 수 있다 —
 * placeId 는 항상 있으므로 프론트는 상세 조회로 보완할 수 있다.
 */
@Builder
@Schema(description = "즐겨찾기 장소 항목 DTO")
public record FavoritePlaceItem(

    @Schema(description = "장소 아이디", example = "212481712381923328")
    String placeId,

    @Schema(description = "장소명 (요약 조회 실패 시 null)", example = "협재해수욕장")
    String title,

    @Schema(description = "관광 타입 표시명", example = "관광지")
    String contentTypeName,

    @Schema(description = "주소", example = "제주특별자치도 제주시 한림읍")
    String addr,

    @Schema(description = "반려견 동반 조건 표시명", example = "동반 가능")
    String petAllowanceName,

    @Schema(description = "실내 여부 (정보 없으면 null)", example = "false")
    Boolean indoor,

    @Schema(description = "대표 이미지 URL", example = "http://tong.visitkorea.or.kr/cms/resource/1.jpg")
    String firstImage
) {

}

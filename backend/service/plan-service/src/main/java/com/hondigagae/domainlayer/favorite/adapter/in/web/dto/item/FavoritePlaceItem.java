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

    @Schema(description = "장소명. tour-service 요약 조회 실패 시 null", example = "협재해수욕장", nullable = true)
    String title,

    @Schema(description = "관광 타입 표시명. 요약 조회 실패 시 null", example = "관광지", nullable = true)
    String contentTypeName,

    @Schema(description = "주소. 요약 조회 실패 시 null", example = "제주특별자치도 제주시 한림읍", nullable = true)
    String addr,

    @Schema(description = "반려견 동반 조건 표시명. 요약 조회 실패 시 null", example = "동반 가능", nullable = true)
    String petAllowanceName,

    @Schema(description = "실내 여부. 원천에 정보가 없거나 요약 조회 실패 시 null", example = "false", nullable = true)
    Boolean indoor,

    @Schema(description = "대표 이미지 URL. 없거나 요약 조회 실패 시 null", example = "http://tong.visitkorea.or.kr/cms/resource/1.jpg", nullable = true)
    String firstImage
) {

}

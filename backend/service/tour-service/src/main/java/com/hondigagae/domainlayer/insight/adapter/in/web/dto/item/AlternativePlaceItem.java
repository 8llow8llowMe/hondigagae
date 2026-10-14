package com.hondigagae.domainlayer.insight.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

/**
 * 비 예보일 때 제안하는 실내 대안 장소. 적합도 응답과 장소 추천 항목이 함께 쓴다.
 *
 * <p>{@code contentType} · {@code sourceCategory} 는 장소 목록({@code PlaceItem})과 같은 뜻 · 같은 값이다 (#1461). 프론트가
 * 대안을 일정에 담을 때 음식점이면 식사로 저장하는데, 그 판정이 목록 카드와 같은 두 값을 보기 때문이다.
 */
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
    CodeNameDescriptionMetadata allowedPetSize,

    @Schema(
        description = "콘텐츠 타입 metadata. 장소 목록(PlaceItem.contentType)과 같은 값이다. 유형을 모르면 null",
        example = "{\"code\":\"RESTAURANT\",\"name\":\"음식점\",\"description\":\"음식점, 카페\"}", nullable = true)
    CodeNameDescriptionMetadata contentType,

    @Schema(
        description = "원본 분류 (원천이 준 값 그대로 — 문화정보원 카테고리, 식약처 업종. 휴게음식점 중 이름이 카페인 곳은 '카페'). 없으면 null",
        example = "카페", nullable = true)
    String sourceCategory
) {
}

package com.hondigagae.domainlayer.favorite.application.info;

import lombok.Builder;

/**
 * 즐겨찾기 목록의 원소. 장소 요약(장식)은 tour-service 조회 실패 시 null 일 수 있다 —
 * 장식이 없어도 목록 자체(placeId)는 항상 내려간다 (관용 원칙).
 */
@Builder
public record FavoritePlaceInfo(
    long placeId,
    String title,
    String contentTypeName,
    String addr,
    String petAllowanceName,
    Boolean indoor,
    String firstImage
) {

}

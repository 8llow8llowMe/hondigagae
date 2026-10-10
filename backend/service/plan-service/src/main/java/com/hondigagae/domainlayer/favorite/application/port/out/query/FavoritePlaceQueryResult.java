package com.hondigagae.domainlayer.favorite.application.port.out.query;

import lombok.Builder;

/**
 * tour-service 가 준 장소 요약 한 건. 즐겨찾기 카드에 필요한 것만 추린다 —
 * 장소 정보의 원천은 tour-service 이고 여기 사본을 두지 않는다.
 */
@Builder
public record FavoritePlaceQueryResult(
    long placeId,
    String title,
    String contentTypeName,
    String addr,
    String petAllowanceName,
    Boolean indoor,
    String firstImage
) {

}

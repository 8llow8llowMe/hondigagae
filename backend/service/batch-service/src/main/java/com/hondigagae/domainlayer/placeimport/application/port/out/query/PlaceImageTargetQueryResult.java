package com.hondigagae.domainlayer.placeimport.application.port.out.query;

/**
 * 추가 이미지 적재 대상 한 곳. TourAPI 원천(contentId 보유)만 대상이 된다 —
 * 문화정보원·식약처 원천은 추가 이미지 API 가 없다.
 */
public record PlaceImageTargetQueryResult(
    long placeId,
    long contentId
) {

}

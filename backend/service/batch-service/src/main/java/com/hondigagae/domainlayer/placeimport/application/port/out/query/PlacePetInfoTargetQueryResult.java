package com.hondigagae.domainlayer.placeimport.application.port.out.query;

/**
 * detailPetTour2 적재 대상 한 곳 (#877).
 *
 * <p>detailIntro2 와 달리 {@code contentTypeId} 를 들지 않는다 — 동반 조건 상세는 타입마다 필드가
 * 다르지 않고 호출 파라미터에도 타입이 필요 없다.
 */
public record PlacePetInfoTargetQueryResult(
    long placeId,
    long contentId
) {

}

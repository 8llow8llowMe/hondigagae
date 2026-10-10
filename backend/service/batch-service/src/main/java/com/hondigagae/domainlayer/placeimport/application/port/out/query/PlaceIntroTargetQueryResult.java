package com.hondigagae.domainlayer.placeimport.application.port.out.query;

/**
 * detailIntro2 적재 대상 한 곳.
 *
 * <p>{@code contentTypeId} 를 함께 들고 오는 이유는 detailIntro2 가 <b>타입마다 필드명이 다른</b>
 * API 라서다 — 같은 "운영시간"이 관광지는 {@code usetime}, 음식점은 {@code opentimefood} 다.
 * 호출 파라미터에도 필요하고 응답 매핑에도 필요하다.
 */
public record PlaceIntroTargetQueryResult(
    long placeId,
    long contentId,
    String contentTypeId
) {

}

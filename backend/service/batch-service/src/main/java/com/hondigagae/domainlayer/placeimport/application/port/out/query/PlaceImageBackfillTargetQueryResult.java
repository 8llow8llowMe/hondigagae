package com.hondigagae.domainlayer.placeimport.application.port.out.query;

/**
 * 대표 이미지 백필 대상 한 곳 — TourAPI 가 아닌 원천(문화정보원·식약처)이면서 이미지가 없는 장소.
 * 좌표는 오적재 방지의 필수 검증 축이라, 좌표가 없는 행은 대상에서 빠진다.
 */
public record PlaceImageBackfillTargetQueryResult(
    long placeId,
    String title,
    double lat,
    double lng
) {

}

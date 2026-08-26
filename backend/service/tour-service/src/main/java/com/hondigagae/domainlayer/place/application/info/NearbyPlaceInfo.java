package com.hondigagae.domainlayer.place.application.info;

import lombok.Builder;

/**
 * 주변 장소 한 건. 목록 항목에 검색 중심점으로부터의 거리를 더한 값이다.
 */
@Builder
public record NearbyPlaceInfo(
    PlaceSummaryInfo place,
    int distanceMeters
) {

}

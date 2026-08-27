package com.hondigagae.domainlayer.congestionimport.application.port.out.query;

/** 매칭 대상 장소. 이름 비교에 필요한 것만 읽는다. */
public record PlaceNameCandidateQueryResult(long placeId, String title) {

}

package com.hondigagae.domainlayer.place.adapter.in.internal.dto;

import lombok.Builder;

/**
 * 다른 서비스(ai-service)가 프롬프트 후보로 쓰는 장소 한 건.
 *
 * <p>공개 목록 응답({@code PlaceItem})과 다른 DTO 를 쓰는 이유는 소비 방식이 다르기 때문이다.
 * 프롬프트는 사람이 읽는 문장이라 enum 메타데이터 대신 <b>표시명</b>을 바로 준다 —
 * 소비 서비스마다 enum 변환을 반복하지 않게 한다.
 */
@Builder
public record PlaceCandidateInternalResponse(
    long placeId,
    String title,
    String contentTypeName,
    String addr,
    String petAllowanceName,
    String allowedPetSizeName,
    Integer maxPetWeightKg,
    Boolean indoor,
    String sourceCategory,
    Double lat,
    Double lng
) {

}

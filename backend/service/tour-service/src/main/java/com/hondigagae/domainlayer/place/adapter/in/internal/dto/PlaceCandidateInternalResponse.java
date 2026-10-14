package com.hondigagae.domainlayer.place.adapter.in.internal.dto;

import lombok.Builder;

/**
 * 다른 서비스(ai-service)가 프롬프트 후보로 쓰는 장소 한 건.
 *
 * <p>공개 목록 응답({@code PlaceItem})과 다른 DTO 를 쓰는 이유는 소비 방식이 다르기 때문이다.
 * 프롬프트는 사람이 읽는 문장이라 enum 메타데이터 대신 <b>표시명</b>을 바로 준다 —
 * 소비 서비스마다 enum 변환을 반복하지 않게 한다.
 *
 * <p>{@code contentTypeCode} 는 예외적으로 enum 이름({@code RESTAURANT} 등)이다 (#1461). 표시명은 문구라 판정에 쓸 수 없는데,
 * plan-service 가 일정 항목 장소 요약에 공개 장소 API 와 같은 {@code contentType} metadata 를 실어야 프론트가 음식점을 식사로 센다.
 * 그래서 metadata 의 세 값(코드 · 표시명 · 설명)을 펴서 준다 — 내부 DTO 라 공통 metadata 타입을 쓰지 않는다
 * ({@code WalkCourseCandidateInternalResponse.fitsActivityLevels} 와 같은 이유).
 */
@Builder
public record PlaceCandidateInternalResponse(
    long placeId,
    String title,
    // ContentType enum 이름 · 표시명 · 설명. 공개 장소 API 의 contentType {code, name, description} 과 같은 값이다. 유형이 없으면 셋 다 null.
    String contentTypeCode,
    String contentTypeName,
    String contentTypeDescription,
    String addr,
    String petAllowanceName,
    String allowedPetSizeName,
    Integer maxPetWeightKg,
    Boolean indoor,
    String sourceCategory,
    // 대표 이미지. 즐겨찾기 카드 등 내부 소비처의 표시용이다.
    String firstImage,
    Double lat,
    Double lng
) {

}

package com.hondigagae.domainlayer.place.application.model;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import lombok.Builder;

/**
 * 장소 목록 조회 조건. filter + cursor + size 가 함께 움직이므로 Criteria 로 묶는다.
 */
@Builder
public record PlaceSearchCriteria(
    String areaCode,
    String sigunguCode,
    ContentType contentType,
    PetAllowanceType petAllowanceType,
    // 비 오는 날 실내 대안을 고를 때 쓴다. null 이면 실내외를 가리지 않는다.
    Boolean indoor,
    AllowedPetSize allowedPetSize,
    // 내 반려견 크기. 받아 주지 않는 것으로 확인된 장소만 뺀다 — 정보 없음(UNKNOWN)은 남긴다.
    PetSizeType petSizeType,
    // 내 반려견 체중(kg). 체중 상한이 명시된 장소("12kg 미만")를 정확히 거른다.
    Integer petWeightKg,
    // 원본 분류로 거른다. contentTypeId 39 에 음식점과 카페가 섞여 있어 이 값이 필요하다.
    String sourceCategory,
    Long lastPlaceId,
    int size
) {

}

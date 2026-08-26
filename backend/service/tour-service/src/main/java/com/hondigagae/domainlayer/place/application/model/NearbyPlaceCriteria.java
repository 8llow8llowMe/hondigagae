package com.hondigagae.domainlayer.place.application.model;

import com.hondigagae.domainlayer.place.domain.enums.AllowedPetSize;
import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.domainlayer.place.domain.enums.PetAllowanceType;
import lombok.Builder;

/**
 * 좌표 반경 기반 장소 조회 조건.
 *
 * <p>지역 코드로 거르는 목록 조회와 달리 "지금 내 위치 주변"을 본다. 여행 중 다음 일정을
 * 고를 때 쓰는 조회라 커서가 아니라 가까운 순 상위 N 개다.
 */
@Builder
public record NearbyPlaceCriteria(
    double lat,
    double lng,
    int radius,
    ContentType contentType,
    PetAllowanceType petAllowanceType,
    Boolean indoor,
    AllowedPetSize allowedPetSize,
    // 원본 분류로 거른다. contentTypeId 39 에 음식점과 카페가 섞여 있어 이 값이 필요하다.
    String sourceCategory,
    int size
) {

}

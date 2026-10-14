package com.hondigagae.domainlayer.insight.application.info;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import lombok.Builder;

/**
 * 비 예보일 때 제안하는 실내 대안 장소.
 *
 * @param contentTypeId  관광공사 콘텐츠 유형 코드(원천 값, 39 음식점 등). 응답에서 metadata 로 바꾼다. 없으면 null (#1461)
 * @param sourceCategory 원천의 원본 분류(카페 등). 없으면 null (#1461)
 */
@Builder
public record AlternativePlaceInfo(
    long placeId,
    String title,
    double lat,
    double lng,
    int distanceMeters,
    PetAllowanceType petAllowanceType,
    AllowedPetSize allowedPetSize,
    String contentTypeId,
    String sourceCategory
) {

}

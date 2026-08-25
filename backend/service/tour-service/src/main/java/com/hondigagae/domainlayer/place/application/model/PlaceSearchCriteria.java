package com.hondigagae.domainlayer.place.application.model;

import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.domainlayer.place.domain.enums.PetAllowanceType;
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
    Long lastPlaceId,
    int size
) {

}

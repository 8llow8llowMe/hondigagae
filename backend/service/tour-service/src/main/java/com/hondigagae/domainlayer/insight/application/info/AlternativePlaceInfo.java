package com.hondigagae.domainlayer.insight.application.info;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import lombok.Builder;

/** 비 예보일 때 제안하는 실내 대안 장소. */
@Builder
public record AlternativePlaceInfo(
    long placeId,
    String title,
    double lat,
    double lng,
    int distanceMeters,
    PetAllowanceType petAllowanceType,
    AllowedPetSize allowedPetSize
) {

}

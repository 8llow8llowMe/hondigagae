package com.hondigagae.domainlayer.place.application.info;

import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import java.math.BigDecimal;
import lombok.Builder;

/**
 * 장소 목록 항목.
 *
 * <p>{@code distanceMeters} 는 목록을 기준 좌표로 거리순 조회했을 때만 있다 (#1202). 정렬 키의 거리(m, 반올림)
 * 그대로라 응답 순서와 어긋나지 않는다. 좌표 없는 목록·주변 검색 안쪽 항목·내부 후보 조회에서는 null 이다 —
 * 주변 검색의 거리는 {@link NearbyPlaceInfo#distanceMeters()} 가 말한다.
 */
@Builder
public record PlaceSummaryInfo(
    long placeId,
    ContentType contentType,
    String title,
    String addr1,
    String sigunguCode,
    BigDecimal lat,
    BigDecimal lng,
    String firstImage,
    String firstImage2,
    PetAllowanceType petAllowanceType,
    AllowedPetSize allowedPetSize,
    Integer maxPetWeightKg,
    String tel,
    Boolean indoor,
    String sourceCategory,
    PlaceSource source,
    Integer distanceMeters
) {

}

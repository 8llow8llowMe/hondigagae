package com.hondigagae.domainlayer.placeimport.application.port.out.query;

import com.hondigagae.domainlayer.placeimport.domain.model.OverridablePlace;

/**
 * 보정 대상 place 행의 지금 값 (#1434). 제목 대조와 "보정을 얹으면 무엇이 바뀌는가" 판정에 쓴다.
 *
 * @param placeId          {@code place.id}
 * @param source           원천 (TOUR_API / CULTURE_PORTAL / MFDS). 로그용
 * @param title            {@code place.title}
 * @param indoor           null 이면 모름
 * @param outdoor          null 이면 모름
 * @param petAllowanceType {@code place.pet_allowance_type} 원문
 * @param allowedPetSize   {@code place.allowed_pet_size} 원문
 * @param petAvailable     {@code place.pet_available}
 */
public record PlaceOverrideTargetQueryResult(
    long placeId, String source, String title, Boolean indoor, Boolean outdoor, String petAllowanceType, String allowedPetSize, boolean petAvailable
) {

    /** 보정이 다루는 칸만 담은 지금 값. */
    public OverridablePlace toOverridablePlace() {
        return new OverridablePlace(placeId, title, indoor, outdoor, petAllowanceType, allowedPetSize, petAvailable);
    }
}

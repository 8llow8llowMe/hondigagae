package com.hondigagae.domainlayer.placeimport.domain.model;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;

/**
 * 근거에서 다시 계산한 장소 한 곳의 동반 가능 여부 · 크기 제한 (#886). 쓰기 포트가 place 행에 그대로 덮는다.
 */
public record ReflectedPetAllowance(long placeId, PetAllowanceType allowance, AllowedPetSize size) {

}

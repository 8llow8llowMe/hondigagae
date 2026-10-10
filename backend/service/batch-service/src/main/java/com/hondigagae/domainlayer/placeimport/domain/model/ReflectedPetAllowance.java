package com.hondigagae.domainlayer.placeimport.domain.model;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;

/**
 * 근거에서 다시 계산한 장소 한 곳의 동반 가능 여부 · 크기 제한 (#886). 쓰기 포트가 place 행에 그대로 덮는다.
 * {@code pet_available} 은 동반 구분에서 따라 나오므로 따로 들지 않는다({@link #petAvailable()}).
 */
public record ReflectedPetAllowance(long placeId, PetAllowanceType allowance, AllowedPetSize size) {

    public boolean petAvailable() {
        return PetAllowancePolicy.petAvailableOf(allowance);
    }
}

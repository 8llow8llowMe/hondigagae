package com.hondigagae.domainlayer.placeimport.application.port.out.query;

import java.util.List;

/**
 * TourAPI 노출 장소 한 곳의 동반 가능 여부 근거 (#886). 값은 컬럼 문자열 그대로다 — 해석은
 * {@code PetAllowancePolicy} 가 한다.
 *
 * @param placeId            대상 place.id (TourAPI · 노출 · 병합되지 않은 행)
 * @param currentAllowance   지금 place.pet_allowance_type
 * @param currentSize        지금 place.allowed_pet_size
 * @param currentPetAvailable 지금 place.pet_available
 * @param petInfoScope       place_pet_info.allowance_scope. 동반 정보 행이 없으면 null
 * @param petInfoSize        place_pet_info.allowed_pet_size. 동반 정보 행이 없으면 null
 * @param absorbedAllowances 이 행으로 흡수된(delisted 아닌) 행들의 pet_allowance_type. 없으면 빈 목록
 * @param absorbedSizes      같은 행들의 allowed_pet_size. 없으면 빈 목록
 */
public record PlacePetAllowanceEvidenceQueryResult(
    long placeId,
    String currentAllowance,
    String currentSize,
    boolean currentPetAvailable,
    String petInfoScope,
    String petInfoSize,
    List<String> absorbedAllowances,
    List<String> absorbedSizes
) {

    public PlacePetAllowanceEvidenceQueryResult {
        absorbedAllowances = absorbedAllowances == null ? List.of() : List.copyOf(absorbedAllowances);
        absorbedSizes = absorbedSizes == null ? List.of() : List.copyOf(absorbedSizes);
    }
}

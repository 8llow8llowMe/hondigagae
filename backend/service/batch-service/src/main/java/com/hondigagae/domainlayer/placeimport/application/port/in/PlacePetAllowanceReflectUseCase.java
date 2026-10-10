package com.hondigagae.domainlayer.placeimport.application.port.in;

import com.hondigagae.domainlayer.placeimport.application.model.PetAllowanceReflectOutcome;

public interface PlacePetAllowanceReflectUseCase {

    /**
     * TourAPI 노출 장소의 {@code pet_allowance_type} · {@code allowed_pet_size} 를 두 근거 — {@code place_pet_info} 와
     * 병합으로 흡수된 행 — 에서 다시 계산해 덮는다 (#886).
     *
     * <p><b>매 실행 처음부터 다시 계산한다.</b> 입력이 같으면 결과가 같고(멱등), 근거가 사라지면 값도 돌아간다.
     * {@code petTourImportJob} 의 적재 뒤, {@code placeMergeJob} 의 병합 뒤에 같은 스텝으로 돈다.
     */
    PetAllowanceReflectOutcome reflectPetAllowances();
}

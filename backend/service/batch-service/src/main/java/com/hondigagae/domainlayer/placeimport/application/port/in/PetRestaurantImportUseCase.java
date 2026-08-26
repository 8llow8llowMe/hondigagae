package com.hondigagae.domainlayer.placeimport.application.port.in;

public interface PetRestaurantImportUseCase {

    /**
     * 식약처 등록 반려동물 동반출입 음식점을 적재한다.
     *
     * @param region 원천의 지역 표기 (예: 제주)
     * @return 적재한 업소 수
     */
    int importPetRestaurants(String region);
}

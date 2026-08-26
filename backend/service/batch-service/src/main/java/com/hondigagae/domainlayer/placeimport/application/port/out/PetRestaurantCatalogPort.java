package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPetRestaurant;
import java.util.List;

/**
 * 식약처 반려동물 동반출입 음식점 목록 조회 계약.
 *
 * <p>원천이 xlsx 라는 사실은 adapter 안에 갇힌다. 좌표는 여기서 채우지 않는다 — 원천에 없다.
 */
public interface PetRestaurantCatalogPort {

    /**
     * 지정한 지역의 등록 업소를 읽는다.
     *
     * @param region 원천의 지역 표기 (예: 제주). null 이면 전국
     */
    List<ImportedPetRestaurant> readPetRestaurants(String region);
}

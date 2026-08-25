package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceCatalogPage;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;

/**
 * 외부 장소 카탈로그(TourAPI) 조회 계약.
 * 전송/파싱 세부는 adapter가 캡슐화한다 (external-api-guide §3).
 */
public interface PlaceCatalogPort {

    PlaceCatalogPage fetchAreaBasedPlaces(String areaCode, PlaceContentType contentType, int pageNo, int numOfRows);
}

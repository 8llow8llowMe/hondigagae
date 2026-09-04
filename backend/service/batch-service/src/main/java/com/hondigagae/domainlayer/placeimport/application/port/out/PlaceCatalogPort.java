package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceCatalogQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlace;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceImage;
import java.util.List;

/**
 * 외부 장소 카탈로그(TourAPI) 조회 계약.
 * 전송/파싱 세부는 adapter가 캡슐화한다 (external-api-guide §3).
 */
public interface PlaceCatalogPort {

    PlaceCatalogQueryResult fetchAreaBasedPlaces(String areaCode, PlaceContentType contentType, int pageNo, int numOfRows);

    /** 콘텐츠 하나의 추가 이미지 전부(detailImage2). 이미지가 없으면 빈 목록이다. */
    List<ImportedPlaceImage> fetchDetailImages(long contentId);

    /** 시설명 키워드 검색(searchKeyword2). 이미지 백필의 후보를 찾는 데 쓴다. */
    List<ImportedPlace> searchPlacesByKeyword(String keyword, String areaCode);
}

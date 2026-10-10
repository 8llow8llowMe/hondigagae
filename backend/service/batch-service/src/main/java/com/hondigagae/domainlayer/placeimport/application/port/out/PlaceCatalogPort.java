package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.application.port.out.query.PetTourSyncQueryResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceCatalogQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlace;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceImage;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceIntro;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlacePetInfo;
import java.util.List;
import java.util.Optional;

/**
 * 외부 장소 카탈로그(TourAPI) 조회 계약.
 * 전송/파싱 세부는 adapter가 캡슐화한다 (external-api-guide §3).
 */
public interface PlaceCatalogPort {

    PlaceCatalogQueryResult fetchAreaBasedPlaces(String areaCode, PlaceContentType contentType, int pageNo, int numOfRows);

    /** 콘텐츠 하나의 추가 이미지 전부(detailImage2). 이미지가 없으면 빈 목록이다. */
    List<ImportedPlaceImage> fetchDetailImages(long contentId);

    /**
     * 콘텐츠 하나의 상세 소개(detailIntro2). 운영시간·휴무일·주차·문의처를 여기서만 얻을 수 있다.
     *
     * <p>응답 필드명이 {@code contentType} 마다 달라 타입을 함께 받는다. 원천에 intro 가 없으면
     * ({@code items=""}) {@code Optional.empty()} — 호출은 성공했지만 줄 내용이 없는 상태다.
     */
    Optional<ImportedPlaceIntro> fetchDetailIntro(long contentId, PlaceContentType contentType);

    /** 시설명 키워드 검색(searchKeyword2). 이미지 백필의 후보를 찾는 데 쓴다. */
    List<ImportedPlace> searchPlacesByKeyword(String keyword, String areaCode);

    /**
     * 반려동물 동반여행 동기화 목록(KorPetTourService2 petTourSyncList2) 한 페이지 (#877).
     * 동반 정보가 있는 contentId 집합과 노출 여부({@code showflag})를 준다.
     *
     * @param areaCode 관광 지역코드 (제주=39). 원천으로는 법정동 시도코드로 옮겨 묻는다 (#726 과 같은 함정)
     */
    PetTourSyncQueryResult fetchPetTourSyncList(String areaCode, int pageNo, int numOfRows);

    /**
     * 콘텐츠 하나의 반려동물 동반 조건(KorPetTourService2 detailPetTour2).
     *
     * <p>원천에 동반 정보가 없으면({@code items=""}) 또는 아홉 필드가 전부 비었으면
     * {@code Optional.empty()} — 호출은 성공했지만 줄 내용이 없는 상태다.
     */
    Optional<ImportedPlacePetInfo> fetchDetailPetTour(long contentId);
}

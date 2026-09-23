package com.hondigagae.domainlayer.placeimport.application.port.in;

public interface PetTourImportUseCase {

    /**
     * 반려동물 동반여행 API 의 동반 조건을 TourAPI 원천 장소의 place_pet_info 로 적재한다 (#877).
     * 장소 적재 뒤에 돌아야 한다 — place 테이블의 TourAPI 행이 결합 대상이다.
     *
     * <p>동기화 목록(petTourSyncList2)으로 동반 정보가 있는 contentId 를 먼저 받고, 그 교집합에만
     * 상세(detailPetTour2)를 부른다. 실행당 상한({@code pet-tour-import.max-calls-per-run}, 기본 350)을 둔다.
     *
     * @param areaCode 관광 지역코드 (제주=39)
     * @return upsert 한 장소 수
     */
    int importPetTourInfos(String areaCode);
}

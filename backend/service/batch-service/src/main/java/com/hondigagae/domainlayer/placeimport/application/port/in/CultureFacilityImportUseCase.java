package com.hondigagae.domainlayer.placeimport.application.port.in;

public interface CultureFacilityImportUseCase {

    /**
     * 문화정보원 문화시설을 적재하고 중복을 병합한다.
     *
     * @param sido 시도 명칭 (예: 제주특별자치도)
     * @return 적재한 시설 수
     */
    int importFacilities(String sido);
}

package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.domain.model.ImportedAnimalHospital;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedCultureFacility;
import java.util.List;

/**
 * 문화정보원 문화시설 목록 조회 계약.
 *
 * <p>원천이 파일(CSV)이라는 사실은 adapter 안에 갇힌다. 나중에 오픈API 로 바꿔도 이 계약은 그대로다.
 */
public interface CultureFacilityCatalogPort {

    /**
     * 지정한 시도의 여행 코스 대상 시설을 읽는다.
     *
     * @param sido 시도 명칭 (예: 제주특별자치도). null 이면 전국
     */
    List<ImportedCultureFacility> readTravelFacilities(String sido);

    /**
     * 같은 파일에서 동물병원만 읽는다. 여행 장소가 아니라 긴급 상황용이라 별도 테이블로 간다.
     *
     * @param sido 시도 명칭. null 이면 전국
     */
    List<ImportedAnimalHospital> readAnimalHospitals(String sido);
}

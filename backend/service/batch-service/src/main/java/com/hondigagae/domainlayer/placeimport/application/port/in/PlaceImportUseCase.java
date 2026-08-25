package com.hondigagae.domainlayer.placeimport.application.port.in;

import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import java.util.List;

public interface PlaceImportUseCase {

    /**
     * 지정 지역의 장소 데이터를 TourAPI에서 수집해 place 테이블에 upsert한다.
     *
     * @param areaCode     TourAPI 지역코드 (제주=39)
     * @param contentTypes 적재할 콘텐츠 타입 목록 (비어 있으면 기본 대상 전체)
     * @return 적재(upsert)한 총 건수
     */
    int importPlaces(String areaCode, List<PlaceContentType> contentTypes);
}

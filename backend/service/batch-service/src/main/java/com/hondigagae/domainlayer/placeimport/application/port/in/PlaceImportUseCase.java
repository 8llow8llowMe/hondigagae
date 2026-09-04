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

    /**
     * TourAPI 원천 장소의 추가 이미지를 detailImage2 로 수집해 place_image 를 교체한다.
     * 장소 적재 뒤에 돌아야 한다 — place 테이블의 TourAPI 행이 대상 목록이다.
     *
     * @return 적재한 이미지 총 장수
     */
    int importPlaceImages();

    /**
     * 문화정보원·식약처 원천 장소의 대표 이미지를 TourAPI 키워드 검색으로 백필한다.
     * 두 원천의 적재 잡 이후에 돌아야 한다. 정규화 제목 일치 + 좌표 근접 검증을 통과한 곳만 채운다.
     *
     * @return 채운 장소 수
     */
    int backfillPlaceImages(String areaCode);
}

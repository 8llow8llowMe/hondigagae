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
     * <p><b>한 실행에서 전량을 덮지 않는다 (#478).</b> 운영시간 스텝과 쿼터(일 1,000건)를 나눠
     * 쓰므로 실행당 상한({@code place-image-import.max-calls-per-run}, 기본 400)만큼만 호출하고
     * "한 번도 부르지 않은 곳 먼저 → {@code place.image_synced_at} 오래된 순"으로 고른다.
     * 주 1회 실행 3주면 전량을 한 바퀴 돈다.
     *
     * @return 적재한 이미지 총 장수
     */
    int importPlaceImages();

    /**
     * TourAPI 원천 장소의 상세 소개를 detailIntro2 로 수집해 place_intro 를 upsert 한다.
     * 장소 적재 뒤에 돈다 — place 테이블의 TourAPI 행이 대상 목록이다.
     *
     * <p><b>한 실행에서 전량을 덮지 않는다.</b> 쿼터(일 1,000건)의 대부분을 이미지 스텝이 쓰므로,
     * 실행당 상한({@code place-intro-import.max-calls-per-run}, 기본 300)만큼만 호출하고
     * "intro 없는 곳 먼저 → synced_at 오래된 순"으로 고른다. 반복 실행이 전량을 덮고 이후에는
     * 갱신 순환이 된다.
     *
     * @return upsert 한 장소 수
     */
    int importPlaceIntros();

    /**
     * 문화정보원·식약처 원천 장소의 대표 이미지를 TourAPI 키워드 검색으로 백필한다.
     * 두 원천의 적재 잡 이후에 돌아야 한다. 정규화 제목 일치 + 좌표 근접 검증을 통과한 곳만 채운다.
     *
     * @return 채운 장소 수
     */
    int backfillPlaceImages(String areaCode);
}

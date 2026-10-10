package com.hondigagae.domainlayer.place.application.port.out;

import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceCoordinateQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceImageQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceIntroQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlacePetInfoQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSitemapEntryQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSliceQueryResult;
import com.hondigagae.domainlayer.place.domain.model.Place;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PlaceRepositoryPort {

    /** 좌표 없는 목록 — {@code placeId} 오름차순 커서 한 페이지. 기준 좌표는 보지 않는다. */
    PlaceSliceQueryResult findPlaces(PlaceSearchCriteria criteria);

    /**
     * 거리순 목록의 후보 (#1202). 목록과 같은 필터(노출 규칙 포함)에 맞고 좌표가 둘 다 있는 장소의 아이디·좌표 <b>전량</b>.
     * 정렬하지 않고 {@code lastPlaceId} 로 자르지도 않는다 — 거리 계산·정렬·커서·자르기는 호출한 쪽이 한다.
     */
    List<PlaceCoordinateQueryResult> findCoordinates(PlaceSearchCriteria criteria);

    /**
     * 거리순 커서를 되살릴 좌표. <b>노출 여부를 보지 않는다</b> — 직전 페이지의 마지막 장소가 그사이 병합·delisted 되어도
     * 좌표는 남아 있어 목록이 이어진다. 장소가 없거나 좌표가 비었으면 빈 값이다.
     */
    Optional<PlaceCoordinateQueryResult> findCoordinateById(long placeId);

    /** 사각 범위 안의 장소. 정확한 반경 필터와 정렬은 호출한 쪽이 한다. */
    List<Place> findNearby(NearbyPlaceCriteria criteria);

    /** 주어진 아이디 중 노출 가능한(병합·delisted 아님) 것만. 일정 항목 검증용. */
    List<Long> findVisibleIds(Collection<Long> placeIds);

    /** 아이디로 노출 가능한 장소를 준다. 없는 아이디는 조용히 빠진다. */
    List<Place> findVisiblePlaces(Collection<Long> placeIds);

    /** 노출 가능한 장소 전량을 아이디 오름차순으로. 사이트맵용이라 아이디·동반 구분·원천 수정일만 준다. */
    List<PlaceSitemapEntryQueryResult> findSitemapEntries();

    Optional<Place> findPlaceById(long placeId);

    Optional<PlaceIntroQueryResult> findIntroByPlaceId(long placeId);

    Optional<PlacePetInfoQueryResult> findPetInfoByPlaceId(long placeId);

    List<PlaceImageQueryResult> findImagesByPlaceId(long placeId);
}

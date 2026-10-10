package com.hondigagae.domainlayer.place.application.port.out;

import com.hondigagae.domainlayer.place.application.info.NearbyPlacesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummariesInfo;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import java.util.Optional;

/**
 * 키워드 검색 결과 캐시.
 *
 * <p>원천은 DB 다. 캐시 장애는 예외로 올리지 않고 미스로 취급한다.
 * 키워드가 없는 목록·주변 조회는 이미 인덱스 경로라 여기에 넣지 않는다.
 */
public interface PlaceSearchCachePort {

    Optional<PlaceSummariesInfo> findList(PlaceSearchCriteria criteria);

    void putList(PlaceSearchCriteria criteria, PlaceSummariesInfo info);

    Optional<NearbyPlacesInfo> findNearby(NearbyPlaceCriteria criteria);

    void putNearby(NearbyPlaceCriteria criteria, NearbyPlacesInfo info);
}

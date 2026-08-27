package com.hondigagae.domainlayer.place.application.port.out;

import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceImageQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceIntroQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlacePetInfoQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSliceQueryResult;
import com.hondigagae.domainlayer.place.domain.model.Place;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PlaceRepositoryPort {

    PlaceSliceQueryResult findPlaces(PlaceSearchCriteria criteria);

    /** 사각 범위 안의 장소. 정확한 반경 필터와 정렬은 호출한 쪽이 한다. */
    List<Place> findNearby(NearbyPlaceCriteria criteria);

    /** 주어진 아이디 중 노출 가능한(병합·delisted 아님) 것만. 일정 항목 검증용. */
    List<Long> findVisibleIds(Collection<Long> placeIds);

    Optional<Place> findPlaceById(long placeId);

    Optional<PlaceIntroQueryResult> findIntroByPlaceId(long placeId);

    Optional<PlacePetInfoQueryResult> findPetInfoByPlaceId(long placeId);

    List<PlaceImageQueryResult> findImagesByPlaceId(long placeId);
}

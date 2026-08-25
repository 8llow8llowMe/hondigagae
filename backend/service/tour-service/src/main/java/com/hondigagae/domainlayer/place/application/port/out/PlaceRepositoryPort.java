package com.hondigagae.domainlayer.place.application.port.out;

import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceImageQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceIntroQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlacePetInfoQueryResult;
import com.hondigagae.domainlayer.place.application.port.out.query.PlaceSliceQueryResult;
import com.hondigagae.domainlayer.place.domain.model.Place;
import java.util.List;
import java.util.Optional;

public interface PlaceRepositoryPort {

    PlaceSliceQueryResult findPlaces(PlaceSearchCriteria criteria);

    Optional<Place> findPlaceById(long placeId);

    Optional<PlaceIntroQueryResult> findIntroByPlaceId(long placeId);

    Optional<PlacePetInfoQueryResult> findPetInfoByPlaceId(long placeId);

    List<PlaceImageQueryResult> findImagesByPlaceId(long placeId);
}

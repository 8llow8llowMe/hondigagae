package com.hondigagae.domainlayer.place.application.port.in;

import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.NearbyPlaceResponse;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.PlaceDetailResponse;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.persistence.dto.SliceResponse;

public interface PlaceWebUseCase {

    SliceResponse<PlaceItem> getPlaces(PlaceSearchCriteria criteria);

    NearbyPlaceResponse getNearbyPlaces(NearbyPlaceCriteria criteria);

    PlaceDetailResponse getPlaceDetail(long placeId);
}

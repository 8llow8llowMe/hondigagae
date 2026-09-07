package com.hondigagae.domainlayer.place.application.service;

import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.NearbyPlaceResponse;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.PlaceDetailResponse;
import com.hondigagae.domainlayer.place.adapter.in.web.presenter.PlacePresenter;
import com.hondigagae.domainlayer.place.application.info.PlaceDetailInfo;
import com.hondigagae.domainlayer.place.application.info.NearbyPlacesInfo;
import com.hondigagae.domainlayer.place.application.info.PlaceSummariesInfo;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.in.PlaceWebUseCase;
import com.hondigagae.domainlayer.place.application.service.processor.PlaceQueryProcessor;
import com.hondigagae.persistence.dto.SliceResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlaceWebFacade implements PlaceWebUseCase {

    private final PlaceQueryProcessor placeQueryProcessor;
    private final PlacePresenter placePresenter;

    @Override
    @Transactional(readOnly = true)
    public SliceResponse<PlaceItem> getPlaces(PlaceSearchCriteria criteria) {
        PlaceSummariesInfo summariesInfo = placeQueryProcessor.getPlaces(criteria);
        return placePresenter.toSliceResponse(summariesInfo);
    }

    @Override
    @Transactional(readOnly = true)
    public NearbyPlaceResponse getNearbyPlaces(NearbyPlaceCriteria criteria) {
        NearbyPlacesInfo info = placeQueryProcessor.getNearbyPlaces(criteria);
        return placePresenter.toNearbyResponse(info, criteria);
    }

    @Override
    @Transactional(readOnly = true)
    public PlaceDetailResponse getPlaceDetail(long placeId) {
        PlaceDetailInfo detailInfo = placeQueryProcessor.getPlaceDetail(placeId);
        return placePresenter.toDetailResponse(detailInfo);
    }
}

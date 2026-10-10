package com.hondigagae.domainlayer.place.application.service;

import com.hondigagae.domainlayer.place.adapter.in.internal.dto.PlaceCandidateInternalResponse;
import com.hondigagae.domainlayer.place.adapter.in.internal.presenter.PlaceInternalPresenter;
import com.hondigagae.domainlayer.place.application.port.in.PlaceInternalUseCase;
import com.hondigagae.domainlayer.place.application.service.processor.PlaceQueryProcessor;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlaceInternalFacade implements PlaceInternalUseCase {

    private final PlaceQueryProcessor placeQueryProcessor;
    private final PlaceInternalPresenter placeInternalPresenter;

    @Override
    @Transactional(readOnly = true)
    public List<Long> findVisiblePlaceIds(List<Long> placeIds) {
        return placeQueryProcessor.findVisibleIds(placeIds);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PlaceCandidateInternalResponse> findPlaceCandidates(List<Long> placeIds) {
        return placeInternalPresenter.toCandidateResponses(
            placeQueryProcessor.getVisiblePlaceSummaries(placeIds));
    }
}

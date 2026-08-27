package com.hondigagae.domainlayer.place.application.service;

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

    @Override
    @Transactional(readOnly = true)
    public List<Long> findVisiblePlaceIds(List<Long> placeIds) {
        return placeQueryProcessor.findVisibleIds(placeIds);
    }
}

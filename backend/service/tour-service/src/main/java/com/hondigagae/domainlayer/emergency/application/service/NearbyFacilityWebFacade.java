package com.hondigagae.domainlayer.emergency.application.service;

import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response.NearbyFacilityResponse;
import com.hondigagae.domainlayer.emergency.adapter.in.web.presenter.NearbyFacilityPresenter;
import com.hondigagae.domainlayer.emergency.application.info.NearbyFacilityInfo;
import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import com.hondigagae.domainlayer.emergency.application.port.in.NearbyFacilityWebUseCase;
import com.hondigagae.domainlayer.emergency.application.service.processor.NearbyFacilityQueryProcessor;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NearbyFacilityWebFacade implements NearbyFacilityWebUseCase {

    private final NearbyFacilityQueryProcessor nearbyFacilityQueryProcessor;
    private final NearbyFacilityPresenter nearbyFacilityPresenter;

    @Override
    @Transactional(readOnly = true)
    public NearbyFacilityResponse searchNearby(NearbyFacilityQuery query) {
        List<NearbyFacilityInfo> infos = nearbyFacilityQueryProcessor.searchNearby(query);
        return nearbyFacilityPresenter.toResponse(infos, query);
    }
}

package com.hondigagae.domainlayer.emergency.application.service;

import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response.NearbyHospitalResponse;
import com.hondigagae.domainlayer.emergency.adapter.in.web.presenter.NearbyHospitalPresenter;
import com.hondigagae.domainlayer.emergency.application.info.NearbyHospitalInfo;
import com.hondigagae.domainlayer.emergency.application.model.NearbyHospitalQuery;
import com.hondigagae.domainlayer.emergency.application.port.in.NearbyHospitalWebUseCase;
import com.hondigagae.domainlayer.emergency.application.service.processor.NearbyHospitalQueryProcessor;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NearbyHospitalWebFacade implements NearbyHospitalWebUseCase {

    private final NearbyHospitalQueryProcessor nearbyHospitalQueryProcessor;
    private final NearbyHospitalPresenter nearbyHospitalPresenter;

    @Override
    @Transactional(readOnly = true)
    public NearbyHospitalResponse searchNearby(NearbyHospitalQuery query) {
        List<NearbyHospitalInfo> infos = nearbyHospitalQueryProcessor.searchNearby(query);
        return nearbyHospitalPresenter.toResponse(infos, query);
    }
}

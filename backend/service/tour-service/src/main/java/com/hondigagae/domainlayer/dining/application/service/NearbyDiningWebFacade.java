package com.hondigagae.domainlayer.dining.application.service;

import com.hondigagae.domainlayer.dining.adapter.in.web.dto.response.NearbyDiningResponse;
import com.hondigagae.domainlayer.dining.adapter.in.web.presenter.NearbyDiningPresenter;
import com.hondigagae.domainlayer.dining.application.info.NearbyDiningInfo;
import com.hondigagae.domainlayer.dining.application.model.NearbyDiningQuery;
import com.hondigagae.domainlayer.dining.application.port.in.NearbyDiningWebUseCase;
import com.hondigagae.domainlayer.dining.application.service.processor.NearbyDiningQueryProcessor;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 주변 식음료 검색 유스케이스.
 *
 * <p>DB 를 건드리지 않아 트랜잭션 경계를 두지 않는다. 외부 호출 하나가 전부다.
 */
@Service
@RequiredArgsConstructor
public class NearbyDiningWebFacade implements NearbyDiningWebUseCase {

    private final NearbyDiningQueryProcessor nearbyDiningQueryProcessor;
    private final NearbyDiningPresenter nearbyDiningPresenter;

    @Override
    public NearbyDiningResponse searchNearby(NearbyDiningQuery query) {
        List<NearbyDiningInfo> infos = nearbyDiningQueryProcessor.searchNearby(query);
        return nearbyDiningPresenter.toResponse(infos);
    }
}

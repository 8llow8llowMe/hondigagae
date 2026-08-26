package com.hondigagae.domainlayer.dining.application.port.in;

import com.hondigagae.domainlayer.dining.adapter.in.web.dto.response.NearbyDiningResponse;
import com.hondigagae.domainlayer.dining.application.model.NearbyDiningQuery;

public interface NearbyDiningWebUseCase {

    NearbyDiningResponse searchNearby(NearbyDiningQuery query);
}

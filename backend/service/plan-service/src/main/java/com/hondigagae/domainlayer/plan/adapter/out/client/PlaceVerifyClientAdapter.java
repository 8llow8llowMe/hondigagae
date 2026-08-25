package com.hondigagae.domainlayer.plan.adapter.out.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PlaceVerifyClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceVerifyQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlaceVerifyClientAdapter implements PlaceVerifyQueryPort {

    private final PlaceVerifyClient placeVerifyClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public boolean existsPlace(long placeId) {
        JsonNode body = internalResponseSupport.requestAndUnwrapOrNull(
            InternalResponseSupport.TOUR_SERVICE, () -> placeVerifyClient.getPlace(placeId));
        return body != null;
    }
}

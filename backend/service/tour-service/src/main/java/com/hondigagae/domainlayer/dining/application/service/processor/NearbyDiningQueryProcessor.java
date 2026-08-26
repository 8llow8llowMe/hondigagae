package com.hondigagae.domainlayer.dining.application.service.processor;

import com.hondigagae.domainlayer.dining.application.info.NearbyDiningInfo;
import com.hondigagae.domainlayer.dining.application.model.NearbyDiningQuery;
import com.hondigagae.domainlayer.dining.application.port.out.NearbyDiningQueryPort;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NearbyDiningQueryProcessor {

    private final NearbyDiningQueryPort nearbyDiningQueryPort;

    public List<NearbyDiningInfo> searchNearby(NearbyDiningQuery query) {
        return nearbyDiningQueryPort.searchNearby(query).stream()
            .map(NearbyDiningInfo::from)
            .toList();
    }
}

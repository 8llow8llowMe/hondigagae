package com.hondigagae.domainlayer.plan.adapter.out.client;

import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PlanPlaceLookupClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PlanPlaceClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPlaceLookupPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlanPlacePointQueryResult;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlanPlaceLookupClientAdapter implements PlanPlaceLookupPort {

    private final PlanPlaceLookupClient planPlaceLookupClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public List<PlanPlacePointQueryResult> findPoints(List<Long> placeIds) {
        if (placeIds.isEmpty()) {
            return List.of();
        }
        List<PlanPlaceClientResponse> body = internalResponseSupport.requestAndUnwrapOrNull(
            InternalResponseSupport.TOUR_SERVICE,
            () -> planPlaceLookupClient.getPlaceSummaries(placeIds));
        if (body == null) {
            throw new PlanException(PlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
        }
        return body.stream()
            // 좌표 없는 장소는 검색 중심점이 될 수 없다. 여기서 빼고 호출부는 해당 항목을 건너뛴다.
            .filter(item -> item.placeId() != null && item.lat() != null && item.lng() != null)
            .map(item -> PlanPlacePointQueryResult.builder()
                .placeId(item.placeId())
                .title(item.title())
                .lat(item.lat())
                .lng(item.lng())
                .build())
            .toList();
    }
}

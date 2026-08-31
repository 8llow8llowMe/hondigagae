package com.hondigagae.domainlayer.plan.adapter.out.client;

import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PlanPlaceLookupClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PlanPlaceClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPlaceLookupPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlanPlaceSummaryQueryResult;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlanPlaceLookupClientAdapter implements PlanPlaceLookupPort {

    private final PlanPlaceLookupClient planPlaceLookupClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public List<PlanPlaceSummaryQueryResult> findSummaries(List<Long> placeIds) {
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
            /*
              아이디 없는 행만 버린다. **좌표 없는 장소는 버리지 않는다** — 원천이 좌표를 주지
              않은 장소도 주소·실내 여부는 쓸 수 있다. 좌표가 필요한 소비처(응급 브리핑)가
              hasPoint() 로 판단한다.
            */
            .filter(item -> item.placeId() != null)
            .map(item -> PlanPlaceSummaryQueryResult.builder()
                .placeId(item.placeId())
                .title(item.title())
                .addr(item.addr())
                .indoor(item.indoor())
                .firstImage(item.firstImage())
                .lat(item.lat())
                .lng(item.lng())
                .build())
            .toList();
    }
}

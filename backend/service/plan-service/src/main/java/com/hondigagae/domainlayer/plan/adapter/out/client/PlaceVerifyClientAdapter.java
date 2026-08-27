package com.hondigagae.domainlayer.plan.adapter.out.client;

import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PlaceVerifyClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceVerifyQueryPort;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlaceVerifyClientAdapter implements PlaceVerifyQueryPort {

    private final PlaceVerifyClient placeVerifyClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public Set<Long> findVisiblePlaceIds(Collection<Long> placeIds) {
        if (placeIds.isEmpty()) {
            return Set.of();
        }
        List<Long> body = internalResponseSupport.requestAndUnwrapOrNull(
            InternalResponseSupport.TOUR_SERVICE,
            () -> placeVerifyClient.getVisiblePlaceIds(List.copyOf(placeIds)));

        // 목록 엔드포인트는 404 를 내지 않는다. null 이면 응답 자체가 깨진 것이라
        // "장소 없음"으로 오판하지 않고 연동 실패로 올린다.
        if (body == null) {
            throw new PlanException(PlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
        }
        return new HashSet<>(body);
    }
}

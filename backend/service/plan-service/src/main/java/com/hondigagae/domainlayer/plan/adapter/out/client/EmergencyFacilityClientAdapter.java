package com.hondigagae.domainlayer.plan.adapter.out.client;

import com.hondigagae.domainlayer.plan.adapter.out.client.feign.EmergencyFacilityClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.EmergencyFacilitiesClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.EmergencyFacilityQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.EmergencyFacilityQueryResult;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class EmergencyFacilityClientAdapter implements EmergencyFacilityQueryPort {

    private final EmergencyFacilityClient emergencyFacilityClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public List<EmergencyFacilityQueryResult> findNearby(double lat, double lng, int radiusMeters, int size) {
        EmergencyFacilitiesClientResponse body = internalResponseSupport.requestAndUnwrapOrNull(
            InternalResponseSupport.TOUR_SERVICE,
            () -> emergencyFacilityClient.searchNearbyFacilities(lat, lng, radiusMeters, size));
        if (body == null || body.facilities() == null) {
            // 검색 엔드포인트는 404 를 내지 않는다. null 이면 응답 자체가 깨진 것이다.
            throw new PlanException(PlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
        }
        return body.facilities().stream()
            .map(item -> EmergencyFacilityQueryResult.builder()
                .name(item.name())
                .typeName(item.facilityType() == null ? null : item.facilityType().name())
                .addr(item.addr())
                .tel(item.tel())
                .distanceMeters(item.distanceMeters() == null ? 0 : item.distanceMeters())
                .open24(Boolean.TRUE.equals(item.open24()))
                .operatingHoursKnown(Boolean.TRUE.equals(item.operatingHoursKnown()))
                .build())
            .toList();
    }
}

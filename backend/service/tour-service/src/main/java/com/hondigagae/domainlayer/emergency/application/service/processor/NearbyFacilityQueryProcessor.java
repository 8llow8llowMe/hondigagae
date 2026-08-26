package com.hondigagae.domainlayer.emergency.application.service.processor;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.emergency.application.info.NearbyFacilityInfo;
import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import com.hondigagae.domainlayer.emergency.application.port.out.EmergencyFacilityRepositoryPort;
import com.hondigagae.domainlayer.emergency.application.port.out.query.EmergencyFacilityQueryResult;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NearbyFacilityQueryProcessor {

    private final EmergencyFacilityRepositoryPort emergencyFacilityRepositoryPort;

    /**
     * 사각 범위 결과를 정확한 반경으로 다듬고 가까운 순으로 자른다.
     *
     * <p>제주 전체가 214곳뿐이라 메모리 정렬 비용이 문제 되지 않는다. 규모가 커지면
     * 공간 인덱스로 옮겨야 하는 지점이 여기다.
     */
    public List<NearbyFacilityInfo> searchNearby(NearbyFacilityQuery query) {
        return emergencyFacilityRepositoryPort.findWithinBox(query).stream()
            .filter(result -> result.lat() != null && result.lng() != null)
            .map(result -> toInfo(result, query))
            .filter(info -> info.distanceMeters() <= query.radius())
            .sorted(Comparator.comparingInt(NearbyFacilityInfo::distanceMeters))
            .limit(query.size())
            .toList();
    }

    private NearbyFacilityInfo toInfo(EmergencyFacilityQueryResult result, NearbyFacilityQuery query) {
        double lat = toDouble(result.lat());
        double lng = toDouble(result.lng());
        int distance = (int) Math.round(GeoDistance.meters(query.lat(), query.lng(), lat, lng));

        return NearbyFacilityInfo.builder()
            .facilityId(result.facilityId())
            .facilityType(result.facilityType())
            .name(result.name())
            .addr(result.addr())
            .lat(lat)
            .lng(lng)
            .tel(result.tel())
            .operatingHours(result.operatingHours())
            .restDate(result.restDate())
            .open24(result.open24())
            .distanceMeters(distance)
            .build();
    }

    private double toDouble(BigDecimal value) {
        return value.doubleValue();
    }
}

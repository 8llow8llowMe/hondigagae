package com.hondigagae.domainlayer.emergency.application.service.processor;

import com.hondigagae.domainlayer.emergency.application.info.NearbyHospitalInfo;
import com.hondigagae.domainlayer.emergency.application.model.NearbyHospitalQuery;
import com.hondigagae.domainlayer.emergency.application.port.out.AnimalHospitalRepositoryPort;
import com.hondigagae.domainlayer.emergency.application.port.out.query.AnimalHospitalQueryResult;
import com.hondigagae.domainlayer.emergency.domain.model.GeoDistance;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NearbyHospitalQueryProcessor {

    private final AnimalHospitalRepositoryPort animalHospitalRepositoryPort;

    /**
     * 사각 범위 결과를 정확한 반경으로 다듬고 가까운 순으로 자른다.
     *
     * <p>제주 전체가 86곳뿐이라 메모리 정렬 비용이 문제 되지 않는다. 규모가 커지면
     * 공간 인덱스로 옮겨야 하는 지점이 여기다.
     */
    public List<NearbyHospitalInfo> searchNearby(NearbyHospitalQuery query) {
        return animalHospitalRepositoryPort.findWithinBox(query).stream()
            .filter(result -> result.lat() != null && result.lng() != null)
            .map(result -> toInfo(result, query))
            .filter(info -> info.distanceMeters() <= query.radius())
            .sorted(Comparator.comparingInt(NearbyHospitalInfo::distanceMeters))
            .limit(query.size())
            .toList();
    }

    private NearbyHospitalInfo toInfo(AnimalHospitalQueryResult result, NearbyHospitalQuery query) {
        double lat = toDouble(result.lat());
        double lng = toDouble(result.lng());
        int distance = (int) Math.round(GeoDistance.meters(query.lat(), query.lng(), lat, lng));

        return NearbyHospitalInfo.builder()
            .hospitalId(result.hospitalId())
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

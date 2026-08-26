package com.hondigagae.domainlayer.emergency.adapter.out.persistence;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.emergency.adapter.out.persistence.entity.AnimalHospitalEntity;
import com.hondigagae.domainlayer.emergency.adapter.out.persistence.repository.AnimalHospitalRepository;
import com.hondigagae.domainlayer.emergency.application.model.NearbyHospitalQuery;
import com.hondigagae.domainlayer.emergency.application.port.out.AnimalHospitalRepositoryPort;
import com.hondigagae.domainlayer.emergency.application.port.out.query.AnimalHospitalQueryResult;
import java.math.BigDecimal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AnimalHospitalPersistenceAdapter implements AnimalHospitalRepositoryPort {

    private final AnimalHospitalRepository animalHospitalRepository;

    @Override
    public List<AnimalHospitalQueryResult> findWithinBox(NearbyHospitalQuery query) {
        double latDelta = GeoDistance.latDelta(query.radius());
        double lngDelta = GeoDistance.lngDelta(query.radius(), query.lat());

        return animalHospitalRepository.findWithinBox(
                BigDecimal.valueOf(query.lat() - latDelta),
                BigDecimal.valueOf(query.lat() + latDelta),
                BigDecimal.valueOf(query.lng() - lngDelta),
                BigDecimal.valueOf(query.lng() + lngDelta),
                // 24시간만 보겠다고 하지 않았으면 null 을 넘겨 조건 자체를 끈다.
                query.open24Only() ? Boolean.TRUE : null
            ).stream()
            .map(this::toQueryResult)
            .toList();
    }

    private AnimalHospitalQueryResult toQueryResult(AnimalHospitalEntity entity) {
        return AnimalHospitalQueryResult.builder()
            .hospitalId(entity.getId())
            .name(entity.getName())
            .addr(entity.getAddr())
            .lat(entity.getLat())
            .lng(entity.getLng())
            .tel(entity.getTel())
            .operatingHours(entity.getOperatingHours())
            .restDate(entity.getRestDate())
            .open24(entity.isOpen24())
            .build();
    }
}

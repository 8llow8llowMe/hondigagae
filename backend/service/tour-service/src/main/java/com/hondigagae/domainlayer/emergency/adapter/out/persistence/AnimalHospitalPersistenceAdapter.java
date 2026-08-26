package com.hondigagae.domainlayer.emergency.adapter.out.persistence;

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

    /** 위도 1도의 대략 거리(m). 사각 범위를 잡을 때만 쓰므로 이 정도 근사면 충분하다. */
    private static final double METERS_PER_LAT_DEGREE = 111_320d;
    /** 고위도에서 cos 가 0에 가까워질 때 경도 폭이 발산하는 것을 막는 하한. */
    private static final double MIN_COS_LAT = 0.01d;

    private final AnimalHospitalRepository animalHospitalRepository;

    @Override
    public List<AnimalHospitalQueryResult> findWithinBox(NearbyHospitalQuery query) {
        double latDelta = query.radius() / METERS_PER_LAT_DEGREE;
        double cosLat = Math.max(Math.cos(Math.toRadians(query.lat())), MIN_COS_LAT);
        double lngDelta = query.radius() / (METERS_PER_LAT_DEGREE * cosLat);

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
